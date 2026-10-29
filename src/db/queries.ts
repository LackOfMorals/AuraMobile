import { asc } from 'drizzle-orm';
import { db, schema } from './index';

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
