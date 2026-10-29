import { and, asc, eq, inArray } from 'drizzle-orm';
import type { OperationStatus } from '../domain/types';
import { instanceRow } from '../services/sync';
import type { OperationStore, StoredInstance, StoredOperation } from '../services/operations/types';
import { upsertInstanceRows } from './syncRepository';
import type { db as appDb } from './index';
import * as schema from './schema';

type Db = typeof appDb;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const toStored = (r: typeof schema.instance.$inferSelect): StoredInstance => ({
  auraId: r.auraId,
  name: r.name,
  status: r.status,
  statusGroup: r.statusGroup,
  memory: r.memory,
  storage: r.storage,
  vectorOptimized: r.vectorOptimized,
  graphAnalyticsPlugin: r.graphAnalyticsPlugin,
  region: r.region,
  cloudProvider: r.cloudProvider,
  tier: r.tier,
  tenantId: r.tenantId,
  syncedAt: r.syncedAt,
  deletedInAuraAt: r.deletedInAuraAt,
});

const HOLDING: OperationStatus[] = ['CONFIRMED', 'RUNNING'];

/** The SQLite implementation of what the operations read and write. */
export function createOperationStore(db: Db): OperationStore {
  const op = schema.operation;
  return {
    async loadInstance(auraId) {
      const rows = await db.select().from(schema.instance).where(eq(schema.instance.auraId, auraId));
      return rows[0] ? toStored(rows[0]) : null;
    },

    async loadSizeOptions(i) {
      if (!i.tenantId || !i.cloudProvider || !i.region || !i.tier) {
        return [];
      }
      const c = schema.instanceConfiguration;
      const rows = await db
        .select({ memory: c.memory, storage: c.storage })
        .from(c)
        .where(and(eq(c.tenantId, i.tenantId), eq(c.cloudProvider, i.cloudProvider), eq(c.region, i.region), eq(c.type, i.tier)));
      return rows;
    },

    async loadOffered(tenantId) {
      const rows = await db.select().from(schema.instanceConfiguration).where(eq(schema.instanceConfiguration.tenantId, tenantId));
      return rows.map(r => ({
        cloudProvider: r.cloudProvider,
        region: r.region,
        regionName: r.regionName,
        type: r.type,
        memory: r.memory,
        storage: r.storage,
        version: r.version,
      }));
    },

    async loadTenantName(tenantId) {
      const rows = await db.select().from(schema.tenant).where(eq(schema.tenant.auraId, tenantId));
      return rows[0]?.name ?? null;
    },

    async holdingOperations(auraId) {
      const rows = await db
        .select({ id: op.id, status: op.status })
        .from(op)
        .where(and(eq(op.instanceId, auraId), inArray(op.status, HOLDING)));
      return rows;
    },

    async createOperation(input) {
      const id = newId();
      await db.insert(op).values({
        id,
        instanceId: input.instance?.auraId ?? null,
        kind: input.kind,
        status: 'PLANNED',
        desired: JSON.stringify(input.desired),
        before: input.before ? JSON.stringify(input.before) : null,
        diff: JSON.stringify(input.plan),
        basedOnSyncedAt: input.instance?.syncedAt ?? null,
        createdAt: input.at,
        updatedAt: input.at,
      });
      return id;
    },

    async loadOperation(id) {
      const rows = await db.select().from(op).where(eq(op.id, id));
      const r = rows[0];
      if (!r) {
        return null;
      }
      const steps = await db.select().from(schema.operationStep).where(eq(schema.operationStep.operationId, id)).orderBy(asc(schema.operationStep.seq));
      return {
        id: r.id,
        kind: r.kind,
        status: r.status,
        desired: JSON.parse(r.desired ?? '{}'),
        before: JSON.parse(r.before ?? 'null') ?? { name: '', status: '', memory: null, storage: null, vectorOptimized: null, graphAnalyticsPlugin: null },
        plan: JSON.parse(r.diff ?? '{"items":[],"warnings":[]}'),
        basedOnSyncedAt: r.basedOnSyncedAt,
        targetId: r.instanceId,
        steps: steps.map(s => ({ seq: s.seq, label: s.label, status: s.status, detail: s.detail })),
        createdAt: r.createdAt,
        confirmedAt: r.confirmedAt,
        finishedAt: r.finishedAt,
        error: r.error,
      } satisfies StoredOperation;
    },

    /** One UPDATE that only matches while the operation is still in `from`: SQLite applies it atomically, so a second caller changes nothing. */
    async moveOperation(id, from, to, extra, at) {
      const result = await db
        .update(op)
        .set({
          status: to,
          updatedAt: at,
          ...(extra.confirmedAt ? { confirmedAt: extra.confirmedAt } : {}),
          ...(extra.finishedAt ? { finishedAt: extra.finishedAt } : {}),
          ...(extra.error ? { error: extra.error } : {}),
        })
        .where(and(eq(op.id, id), eq(op.status, from)));
      return result.rowsAffected > 0;
    },

    async addSteps(id, steps) {
      await db.insert(schema.operationStep).values(steps.map(s => ({ operationId: id, seq: s.seq, label: s.label, status: s.status, at: s.at ?? null })));
    },

    async setStep(id, seq, status, at, detail) {
      await db
        .update(schema.operationStep)
        .set({ status, at, ...(detail !== undefined ? { detail } : {}) })
        .where(and(eq(schema.operationStep.operationId, id), eq(schema.operationStep.seq, seq)));
    },

    async unfinishedOperations() {
      return db.select({ id: op.id }).from(op).where(inArray(op.status, HOLDING));
    },

    async refreshInstance(detail, at) {
      await upsertInstanceRows(db, [instanceRow(detail, detail.tenant_id)], at);
    },

    async markInstanceDeleted(auraId, at) {
      await db.update(schema.instance).set({ deletedInAuraAt: at }).where(eq(schema.instance.auraId, auraId));
    },

    async recordCreatedInstance(operationId, created, r, at) {
      await upsertInstanceRows(
        db,
        [
          {
            auraId: created.id,
            tenantId: r.tenantId,
            name: r.name,
            status: 'creating',
            statusGroup: 'IN_PROGRESS',
            connectionUrl: created.connection_url,
            cloudProvider: r.cloudProvider,
            region: r.region,
            tier: r.type,
            memory: r.memory,
            storage: r.storage,
            vectorOptimized: r.vectorOptimized,
            graphAnalyticsPlugin: r.graphAnalyticsPlugin,
            secondariesCount: null,
            cdcEnrichmentMode: null,
            metricsIntegrationUrl: null,
            graphNodes: null,
            graphRelationships: null,
            customerManagedKeyId: null,
            createdAt: at,
          },
        ],
        at,
      );
      await db.update(op).set({ instanceId: created.id }).where(eq(op.id, operationId));
    },
  };
}
