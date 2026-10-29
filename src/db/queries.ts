import { asc, desc } from 'drizzle-orm';
import { sizeOptions } from '../lib/changes';
import { operationSubject } from '../lib/operations';
import type { StoredOperation } from '../services/operations/types';
import { db, schema } from './index';
import { createOperationStore } from './operationRepository';

export type InstanceRecord = typeof schema.instance.$inferSelect;

/** Everything stored, removed instances included: the screens filter, so the "show removed" switch works. */
export function listInstances(): Promise<InstanceRecord[]> {
  return db.select().from(schema.instance).orderBy(asc(schema.instance.name));
}

/** Null when the instance is not stored, so a screen can tell that from "still loading". */
export async function getInstance(auraId: string): Promise<InstanceRecord | null> {
  return (await listInstances()).find(i => i.auraId === auraId) ?? null;
}

export async function tenantNames(): Promise<Map<string, string>> {
  const rows = await db.select().from(schema.tenant);
  return new Map(rows.map(t => [t.auraId, t.name]));
}

export async function lastSyncedAt(): Promise<string | null> {
  return (await db.select().from(schema.account))[0]?.lastSyncAt ?? null;
}

export interface OperationListItem {
  id: string;
  kind: typeof schema.operation.$inferSelect.kind;
  status: typeof schema.operation.$inferSelect.status;
  /** What the change was about: the instance's name, or the name asked for in a create. */
  subject: string;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
}

/** Newest first. */
export async function listOperations(): Promise<OperationListItem[]> {
  const rows = await db.select().from(schema.operation).orderBy(desc(schema.operation.createdAt));
  const names = new Map((await db.select({ id: schema.instance.auraId, name: schema.instance.name }).from(schema.instance)).map(r => [r.id, r.name]));
  return rows.map(o => ({
    id: o.id,
    kind: o.kind,
    status: o.status,
    subject: operationSubject({ target: names.has(o.instanceId ?? '') ? [{ name: names.get(o.instanceId!)! }] : [], before: o.before, diff: o.diff }),
    createdAt: o.createdAt,
    finishedAt: o.finishedAt,
    error: o.error,
  }));
}

/** One operation with its steps, and what it was about. Null when it does not exist. */
export async function getOperation(id: string): Promise<(StoredOperation & { subject: string }) | null> {
  const op = await createOperationStore(db).loadOperation(id);
  if (!op) {
    return null;
  }
  const instance = op.targetId ? await getInstance(op.targetId) : null;
  return {
    ...op,
    subject: operationSubject({
      target: instance ? [{ name: instance.name }] : [],
      before: JSON.stringify(op.before),
      diff: JSON.stringify(op.plan),
    }),
  };
}

/** An instance and the memory and storage pairs its tenant offers for its cloud, region and tier. Null if not stored. */
export async function getEditContext(auraId: string) {
  const instance = await getInstance(auraId);
  if (!instance) {
    return null;
  }
  const sizes = await createOperationStore(db).loadSizeOptions({ ...instance, vectorOptimized: instance.vectorOptimized, graphAnalyticsPlugin: instance.graphAnalyticsPlugin });
  return { instance, sizes: sizeOptions(sizes) };
}
