import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import type { ConfigurationRow, InstanceRow, SyncStore, TenantRow } from '../services/sync';
import type { db as appDb } from './index';
import * as schema from './schema';

type Db = typeof appDb;

export const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Takes the incoming value for a column on conflict. */
const excluded = (column: { name: string }) => sql.raw(`excluded."${column.name}"`);

/**
 * Inserts or updates instances by auraId. Every column an incoming row carries is replaced. hasStoredPassword and
 * passwordRevealCount are not in InstanceRow, so this never resets what only this app knows. Clears deletedInAuraAt.
 */
export async function upsertInstanceRows(db: Db, instances: InstanceRow[], syncedAt: string): Promise<void> {
  if (instances.length === 0) {
    return;
  }
  const replaced = Object.fromEntries(
    [...Object.keys(instances[0]!), 'syncedAt']
      .filter(key => key !== 'auraId')
      .map(key => [key, excluded(schema.instance[key as keyof typeof schema.instance] as { name: string })]),
  );
  for (const group of chunks(instances, 20)) {
    await db
      .insert(schema.instance)
      .values(group.map(i => ({ ...i, syncedAt, deletedInAuraAt: null })))
      .onConflictDoUpdate({
        target: schema.instance.auraId,
        set: { ...replaced, deletedInAuraAt: null },
      });
  }
}

/** The SQLite implementation of what a sync writes. Rows are inserted in chunks, one statement each. */
export function createSyncStore(db: Db, accountId: string): SyncStore {
  return {
    async startRun(startedAt) {
      const id = newId();
      await db.insert(schema.syncRun).values({ id, startedAt, status: 'RUNNING' });
      return id;
    },

    async finishRun(runId, fields) {
      await db
        .update(schema.syncRun)
        .set({
          finishedAt: fields.finishedAt,
          status: fields.status,
          tenants: fields.tenants,
          instances: fields.instances,
          configurations: fields.configurations,
          requests: fields.requests,
          retries: fields.retries,
          error: fields.error ?? null,
        })
        .where(eq(schema.syncRun.id, runId));
    },

    async upsertTenants(tenants: TenantRow[], syncedAt) {
      for (const group of chunks(tenants, 50)) {
        await db
          .insert(schema.tenant)
          .values(group.map(t => ({ ...t, syncedAt })))
          .onConflictDoUpdate({
            target: schema.tenant.auraId,
            set: { name: excluded(schema.tenant.name), syncedAt: excluded(schema.tenant.syncedAt) },
          });
      }
    },

    async replaceConfigurations(tenantId, configurations: ConfigurationRow[], syncedAt) {
      const keys = configurations.map(c => c.key);
      const stale = keys.length
        ? and(eq(schema.instanceConfiguration.tenantId, tenantId), notInArray(schema.instanceConfiguration.key, keys))
        : eq(schema.instanceConfiguration.tenantId, tenantId);
      await db.delete(schema.instanceConfiguration).where(stale);
      for (const group of chunks(configurations, 50)) {
        await db
          .insert(schema.instanceConfiguration)
          .values(group.map(c => ({ ...c, syncedAt })))
          .onConflictDoUpdate({
            target: [schema.instanceConfiguration.tenantId, schema.instanceConfiguration.key],
            set: { syncedAt: excluded(schema.instanceConfiguration.syncedAt) },
          });
      }
      await db.update(schema.tenant).set({ configsSyncedAt: syncedAt }).where(eq(schema.tenant.auraId, tenantId));
    },

    upsertInstances: (instances: InstanceRow[], syncedAt) => upsertInstanceRows(db, instances, syncedAt),

    async markGone(listedIds, syncedAt) {
      const present = await db
        .select({ auraId: schema.instance.auraId })
        .from(schema.instance)
        .where(isNull(schema.instance.deletedInAuraAt));
      const listed = new Set(listedIds);
      const gone = present.map(r => r.auraId).filter(id => !listed.has(id));
      for (const group of chunks(gone, 100)) {
        await db.update(schema.instance).set({ deletedInAuraAt: syncedAt }).where(inArray(schema.instance.auraId, group));
      }
      return gone.length;
    },

    async setAccountSynced(at) {
      await db.update(schema.account).set({ lastSyncAt: at }).where(eq(schema.account.id, accountId));
    },
  };
}
