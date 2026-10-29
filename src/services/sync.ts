// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Adapted from grandstack-web-aura: the same steps and rules, writing to the on-device store instead of a GraphQL one.
import { AuraApiError, AuraAuthError, AuraUnreachableError } from "../aura/client";
import type { AuraApi, InstanceDetail } from "../aura/types";
import { statusGroup } from "../lib/status";

export interface TenantRow {
  auraId: string;
  name: string;
}

export interface ConfigurationRow {
  /** Stable for one offered combination within a tenant, so a sync can keep it and drop it when Aura stops offering it. */
  key: string;
  tenantId: string;
  cloudProvider: string;
  region: string;
  regionName: string;
  type: string;
  memory: string;
  storage: string;
  version: string;
}

export interface InstanceRow {
  auraId: string;
  tenantId: string;
  name: string;
  status: string;
  statusGroup: ReturnType<typeof statusGroup>;
  connectionUrl: string | null;
  cloudProvider: string | null;
  region: string | null;
  tier: string | null;
  memory: string | null;
  storage: string | null;
  vectorOptimized: boolean | null;
  graphAnalyticsPlugin: boolean | null;
  secondariesCount: number | null;
  cdcEnrichmentMode: string | null;
  metricsIntegrationUrl: string | null;
  graphNodes: number | null;
  graphRelationships: number | null;
  customerManagedKeyId: string | null;
  createdAt: string | null;
}

export type SyncOutcome = "SUCCEEDED" | "SLOWED" | "FAILED";

export interface SyncResult {
  runId: string;
  status: SyncOutcome;
  tenants: number;
  instances: number;
  configurations: number;
  requests: number;
  retries: number;
  /** Instances that were in the list but gone by the time their details were read. */
  vanished: number;
  /** Instances no longer in Aura, now marked deletedInAuraAt. */
  markedDeleted: number;
  error?: string;
}

/** Where a sync writes. The SQLite repository is the real one; tests use an in-memory one. */
export interface SyncStore {
  startRun(startedAt: string): Promise<string>;
  finishRun(runId: string, fields: Omit<SyncResult, "runId" | "vanished" | "markedDeleted"> & { finishedAt: string }): Promise<void>;
  upsertTenants(tenants: TenantRow[], syncedAt: string): Promise<void>;
  /** Makes the tenant's stored offers exactly `configurations`: adds new ones, refreshes the rest, removes those no longer offered. */
  replaceConfigurations(tenantId: string, configurations: ConfigurationRow[], syncedAt: string): Promise<void>;
  /** Inserts or updates by auraId. Clears deletedInAuraAt, and keeps what only this app knows (stored password flag, reveal count). */
  upsertInstances(instances: InstanceRow[], syncedAt: string): Promise<void>;
  /** Marks every stored instance not in `listedIds` (and not already marked) as gone, and says how many. */
  markGone(listedIds: string[], syncedAt: string): Promise<number>;
  setAccountSynced(at: string): Promise<void>;
}

export interface SyncDeps {
  aura: AuraApi;
  store: SyncStore;
  /** How many instance detail requests run at once. */
  concurrency?: number;
  now?: () => Date;
}

const iso = (d: Date) => d.toISOString();

/** What we say about a failure. Only text that cannot hold a secret. */
export function describeFailure(err: unknown): string {
  if (err instanceof AuraAuthError) return "Aura rejected the stored client id and secret. Replace the credentials.";
  if (err instanceof AuraUnreachableError) return "Could not reach Aura. Try again in a moment.";
  if (err instanceof AuraApiError) return err.message;
  return "The sync stopped because of an unexpected error.";
}

/** Run `work` over `items`, at most `limit` at a time, keeping the order of results. */
export async function mapPool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]!);
      }
    }),
  );
  return results;
}

/** A stable key for one offered combination within a tenant. It is the combination itself, so it needs no hashing. */
export function configKey(c: { cloud_provider: string; region: string; type: string; memory: string; storage: string; version: string }): string {
  return [c.cloud_provider, c.region, c.type, c.memory, c.storage, c.version].join("\u001f");
}

const numberOrNull = (v: unknown): number | null => {
  const n = v === undefined || v === null || v === "" ? Number.NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** An instance as the store keeps it, from what Aura's detail endpoint returned. */
export function instanceRow(detail: InstanceDetail, tenantId: string): InstanceRow {
  return {
    auraId: detail.id,
    tenantId,
    name: detail.name,
    status: detail.status,
    statusGroup: statusGroup(detail.status),
    connectionUrl: detail.connection_url ?? null,
    cloudProvider: detail.cloud_provider ?? null,
    region: detail.region ?? null,
    tier: detail.type ?? null,
    memory: detail.memory ?? null,
    // Free instances have no storage
    storage: detail.storage ?? null,
    vectorOptimized: detail.vector_optimized ?? null,
    graphAnalyticsPlugin: detail.graph_analytics_plugin ?? null,
    secondariesCount: numberOrNull(detail.secondaries_count),
    cdcEnrichmentMode: detail.cdc_enrichment_mode ?? null,
    metricsIntegrationUrl: detail.metrics_integration_url ?? null,
    // The spec says these are strings, but the real API sends numbers. Either is kept as a number.
    graphNodes: numberOrNull(detail.graph_nodes),
    graphRelationships: numberOrNull(detail.graph_relationships),
    customerManagedKeyId: detail.customer_managed_key_id ?? null,
    createdAt: detail.created_at ?? null,
  };
}

/**
 * Runs a sync. The run is recorded before any work, and a failed sync is a FAILED run, not an exception,
 * so the caller always gets a result to show.
 */
export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const { aura, store } = deps;
  const now = deps.now ?? (() => new Date());
  aura.resetStats?.();
  const runId = await store.startRun(iso(now()));
  const result: SyncResult = { runId, status: "SUCCEEDED", tenants: 0, instances: 0, configurations: 0, requests: 0, retries: 0, vanished: 0, markedDeleted: 0 };
  try {
    await sync(deps, result);
    result.status = (aura.stats?.rateLimited ?? 0) > 0 ? "SLOWED" : "SUCCEEDED";
  } catch (err) {
    result.status = "FAILED";
    result.error = describeFailure(err);
  }
  result.requests = aura.stats?.requests ?? 0;
  result.retries = aura.stats?.retries ?? 0;
  try {
    await store.finishRun(runId, {
      status: result.status,
      tenants: result.tenants,
      instances: result.instances,
      configurations: result.configurations,
      requests: result.requests,
      retries: result.retries,
      error: result.error,
      finishedAt: iso(now()),
    });
    if (result.status !== "FAILED") await store.setAccountSynced(iso(now()));
  } catch {
    // The run could not be recorded as finished. Keep the original result; the next sync starts a new run.
  }
  return result;
}

async function sync(deps: SyncDeps, result: SyncResult): Promise<void> {
  const { aura, store } = deps;
  const syncedAt = iso((deps.now ?? (() => new Date()))());

  // 1. Tenants and the options each can create
  const tenants = await aura.listTenants();
  await store.upsertTenants(tenants.map((t) => ({ auraId: t.id, name: t.name })), syncedAt);
  result.tenants = tenants.length;

  for (const tenant of tenants) {
    const detail = await aura.getTenant(tenant.id);
    const rows = new Map<string, ConfigurationRow>();
    for (const c of detail.instance_configurations) {
      const key = configKey(c);
      rows.set(key, { key, tenantId: tenant.id, cloudProvider: c.cloud_provider, region: c.region, regionName: c.region_name, type: c.type, memory: c.memory, storage: c.storage, version: c.version });
    }
    await store.replaceConfigurations(tenant.id, [...rows.values()], syncedAt);
    result.configurations += rows.size;
  }

  // 2. Instances. The list is only a summary, so each instance is read on its own for its status and size.
  const summaries = await aura.listInstances();
  const tenantOf = new Map(summaries.map((s) => [s.id, s.tenant_id]));
  const details = (
    await mapPool(summaries, deps.concurrency ?? 3, async (summary) => {
      try {
        return await aura.getInstance(summary.id);
      } catch (err) {
        if (err instanceof AuraApiError && err.status === 404) {
          result.vanished++;
          return undefined;
        }
        throw err;
      }
    })
  ).filter((d): d is InstanceDetail => d !== undefined);

  await store.upsertInstances(details.map((d) => instanceRow(d, tenantOf.get(d.id) ?? d.tenant_id)), syncedAt);

  // Instances the store has but Aura no longer lists: keep them for history, marked as gone
  result.markedDeleted = await store.markGone(summaries.map((s) => s.id), syncedAt);
  result.instances = details.length;
}
