import { AuraApiError, AuraAuthError } from "../aura/client";
import { MockAura } from "../aura/mock";
import type { AuraApi, InstanceDetail } from "../aura/types";
import { ConfigurationRow, InstanceRow, SyncResult, SyncStore, TenantRow, configKey, describeFailure, instanceRow, mapPool, runSync } from "./sync";

class MemoryStore implements SyncStore {
  tenants = new Map<string, TenantRow>();
  configs = new Map<string, ConfigurationRow[]>();
  instances = new Map<string, InstanceRow & { deletedInAuraAt: string | null }>();
  runs: { id: string; startedAt: string; finished?: Record<string, unknown> }[] = [];
  accountSyncedAt: string | undefined;

  async startRun(startedAt: string) {
    const id = `run-${this.runs.length + 1}`;
    this.runs.push({ id, startedAt });
    return id;
  }
  async finishRun(runId: string, fields: Record<string, unknown>) {
    this.runs.find((r) => r.id === runId)!.finished = fields;
  }
  async upsertTenants(tenants: TenantRow[]) {
    tenants.forEach((t) => this.tenants.set(t.auraId, t));
  }
  async replaceConfigurations(tenantId: string, configurations: ConfigurationRow[]) {
    this.configs.set(tenantId, configurations);
  }
  async upsertInstances(instances: InstanceRow[]) {
    instances.forEach((i) => this.instances.set(i.auraId, { ...i, deletedInAuraAt: null }));
  }
  async markGone(listedIds: string[], syncedAt: string) {
    let n = 0;
    for (const i of this.instances.values()) {
      if (!listedIds.includes(i.auraId) && i.deletedInAuraAt === null) {
        i.deletedInAuraAt = syncedAt;
        n++;
      }
    }
    return n;
  }
  async setAccountSynced(at: string) {
    this.accountSyncedAt = at;
  }
}

const ok = (r: SyncResult) => expect(r.error).toBeUndefined();

describe("runSync", () => {
  it("stores tenants, offers and instances, and records a finished run", async () => {
    const store = new MemoryStore();
    const result = await runSync({ aura: new MockAura(), store });
    ok(result);
    expect(result).toMatchObject({ status: "SUCCEEDED", tenants: 2, instances: 4, vanished: 0, markedDeleted: 0 });
    expect(result.configurations).toBeGreaterThan(0);
    expect([...store.tenants.keys()].sort()).toEqual(["demo-tenant-1", "demo-tenant-2"]);
    expect(store.configs.get("demo-tenant-1")!.length).toBeGreaterThan(0);
    expect(store.instances.get("d0000004")).toMatchObject({ status: "loading failed", statusGroup: "FAILED", tenantId: "demo-tenant-2" });
    expect(store.instances.get("d0000001")).toMatchObject({ tier: "professional-db", cloudProvider: "gcp", memory: "8GB", vectorOptimized: true });
    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]!.finished).toMatchObject({ status: "SUCCEEDED", instances: 4, tenants: 2 });
    expect(store.accountSyncedAt).toBeDefined();
  });

  it("keeps free-instance counts as numbers, even though Aura's spec says strings", async () => {
    const store = new MemoryStore();
    await runSync({ aura: new MockAura(), store });
    expect(store.instances.get("d0000003")).toMatchObject({ graphNodes: 120, graphRelationships: 340, storage: "2GB" });
  });

  it("marks an instance Aura no longer lists as gone, instead of removing it", async () => {
    const aura = new MockAura();
    const store = new MemoryStore();
    await runSync({ aura, store });
    await aura.deleteInstance("d0000002");
    await aura.getInstance("d0000002"); // destroying
    await aura.getInstance("d0000002").catch(() => undefined); // gone
    const second = await runSync({ aura, store, now: () => new Date("2027-01-01T00:00:00Z") });
    expect(second.markedDeleted).toBe(1);
    expect(second.instances).toBe(3);
    expect(store.instances.get("d0000002")!.deletedInAuraAt).toBe("2027-01-01T00:00:00.000Z");
    expect(store.instances.get("d0000001")!.deletedInAuraAt).toBeNull();
    const third = await runSync({ aura, store });
    expect(third.markedDeleted).toBe(0); // already marked, not marked again
  });

  it("counts an instance that vanishes between the list and its details, and carries on", async () => {
    const aura = new MockAura();
    const real = aura.getInstance.bind(aura);
    aura.getInstance = async (id: string) => {
      if (id === "d0000002") throw new AuraApiError(404, [{ message: "gone" }]);
      return real(id);
    };
    const store = new MemoryStore();
    const result = await runSync({ aura, store });
    ok(result);
    expect(result).toMatchObject({ vanished: 1, instances: 3 });
    expect(store.instances.has("d0000002")).toBe(false);
  });

  it("reports a rejected login as a failed run, with a message that holds no secret, and does not mark the account synced", async () => {
    const aura = new MockAura();
    aura.listTenants = async () => {
      throw new AuraAuthError();
    };
    const store = new MemoryStore();
    const result = await runSync({ aura, store });
    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("Aura rejected the stored client id and secret. Replace the credentials.");
    expect(store.runs[0]!.finished).toMatchObject({ status: "FAILED" });
    expect(store.accountSyncedAt).toBeUndefined();
  });

  it("is SLOWED when Aura rate-limited it, but still succeeds", async () => {
    const aura: AuraApi = Object.assign(new MockAura(), { stats: { requests: 9, retries: 2, rateLimited: 2 }, resetStats: () => undefined });
    const result = await runSync({ aura, store: new MemoryStore() });
    expect(result).toMatchObject({ status: "SLOWED", requests: 9, retries: 2 });
    ok(result);
  });

  it("still returns its result if recording the end of the run fails", async () => {
    const store = new MemoryStore();
    store.finishRun = async () => {
      throw new Error("disk full");
    };
    const result = await runSync({ aura: new MockAura(), store });
    expect(result.status).toBe("SUCCEEDED");
  });
});

describe("mapPool", () => {
  it("keeps the order of results and never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapPool([30, 10, 20, 5, 15], 2, async (ms) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return ms * 2;
    });
    expect(out).toEqual([60, 20, 40, 10, 30]);
    expect(peak).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await mapPool([], 3, async (x) => x)).toEqual([]);
  });
});

describe("helpers", () => {
  it("gives the same key for the same offer and a different one otherwise", () => {
    const c = { cloud_provider: "gcp", region: "r", type: "t", memory: "4GB", storage: "16GB", version: "5" };
    expect(configKey(c)).toBe(configKey({ ...c }));
    expect(configKey(c)).not.toBe(configKey({ ...c, memory: "8GB" }));
  });

  it("turns missing optional fields into nulls", () => {
    const detail = { id: "i", name: "n", status: "running", connection_url: "u", created_at: "c", region: "r", type: "t", cloud_provider: "gcp", tenant_id: "x", memory: "1GB", storage: "2GB" } as InstanceDetail;
    expect(instanceRow(detail, "x")).toMatchObject({ vectorOptimized: null, secondariesCount: null, graphNodes: null, cdcEnrichmentMode: null });
  });

  it("describes failures without detail that could hold a secret", () => {
    expect(describeFailure(new Error("Authorization: Basic abc123"))).toBe("The sync stopped because of an unexpected error.");
  });
});
