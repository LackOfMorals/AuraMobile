// Test support: an in-memory OperationStore, so the engine is tested without a database.
import type { CreatedInstance, InstanceDetail } from "../../aura/types";
import { statusGroup } from "../../lib/status";
import type { Plan, Snapshot } from "./diff";
import type { OfferedConfiguration } from "./plan";
import type { CreateRequest, OperationKind, OperationStatus } from "./state";
import type { CredentialVault, NewOperation, OperationStore, StoredInstance, StoredOperation, StoredStep } from "./types";

export function storedInstance(over: Partial<StoredInstance> = {}): StoredInstance {
  return {
    auraId: "d0000001",
    name: "orders-prod",
    status: "running",
    statusGroup: "READY",
    memory: "8GB",
    storage: "32GB",
    vectorOptimized: true,
    graphAnalyticsPlugin: false,
    region: "europe-west1",
    cloudProvider: "gcp",
    tier: "professional-db",
    tenantId: "demo-tenant-1",
    syncedAt: "2026-03-04T10:00:00Z",
    deletedInAuraAt: null,
    ...over,
  };
}

export const OFFERED: OfferedConfiguration[] = [
  { cloudProvider: "gcp", region: "europe-west1", regionName: "Belgium (europe-west1)", type: "professional-db", memory: "4GB", storage: "16GB", version: "5" },
  { cloudProvider: "gcp", region: "europe-west1", regionName: "Belgium (europe-west1)", type: "professional-db", memory: "8GB", storage: "32GB", version: "5" },
  { cloudProvider: "aws", region: "eu-west-1", regionName: "Ireland (eu-west-1)", type: "professional-db", memory: "4GB", storage: "16GB", version: "5" },
];

interface Row {
  id: string;
  kind: OperationKind;
  status: OperationStatus;
  desired: StoredOperation["desired"];
  before: Snapshot;
  plan: Plan;
  basedOnSyncedAt: string | null;
  targetId: string | null;
  steps: StoredStep[];
  error?: string;
}

export class MemoryOperationStore implements OperationStore {
  instances = new Map<string, StoredInstance>();
  tenants = new Map<string, string>([["demo-tenant-1", "Demo project"]]);
  offered = OFFERED;
  operations = new Map<string, Row>();
  private next = 1;

  constructor(instances: StoredInstance[] = [storedInstance()]) {
    instances.forEach((i) => this.instances.set(i.auraId, i));
  }

  async loadInstance(auraId: string) {
    const i = this.instances.get(auraId);
    return i ? { ...i } : null;
  }
  async loadSizeOptions(i: StoredInstance) {
    return this.offered.filter((o) => o.cloudProvider === i.cloudProvider && o.region === i.region && o.type === i.tier).map(({ memory, storage }) => ({ memory, storage }));
  }
  async loadOffered() {
    return this.offered;
  }
  async loadTenantName(tenantId: string) {
    return this.tenants.get(tenantId) ?? null;
  }
  async hasFreeInstance() {
    return [...this.instances.values()].some((i) => i.tier === "free-db" && i.deletedInAuraAt === null);
  }
  async holdingOperations(auraId: string) {
    return [...this.operations.values()].filter((o) => o.targetId === auraId && (o.status === "CONFIRMED" || o.status === "RUNNING")).map((o) => ({ id: o.id, status: o.status }));
  }
  async createOperation(input: NewOperation) {
    const id = `op-${this.next++}`;
    this.operations.set(id, {
      id,
      kind: input.kind,
      status: "PLANNED",
      desired: JSON.parse(JSON.stringify(input.desired)),
      before: input.before ?? { name: "", status: "", memory: null, storage: null, vectorOptimized: null, graphAnalyticsPlugin: null },
      plan: input.plan,
      basedOnSyncedAt: input.instance?.syncedAt ?? null,
      targetId: input.instance?.auraId ?? null,
      steps: [],
    });
    return id;
  }
  async loadOperation(id: string) {
    const o = this.operations.get(id);
    return o ? ({ createdAt: "", confirmedAt: null, finishedAt: null, ...o, error: o.error ?? null, steps: o.steps.map((s) => ({ ...s })) } as StoredOperation) : null;
  }
  async moveOperation(id: string, from: OperationStatus, to: OperationStatus, extra: { error?: string }, _at?: string) {
    const o = this.operations.get(id);
    if (!o || o.status !== from) return false;
    o.status = to;
    if (extra.error) o.error = extra.error;
    return true;
  }
  async addSteps(id: string, steps: { seq: number; label: string; status: StoredStep["status"] }[]) {
    this.operations.get(id)!.steps = steps.map((s) => ({ ...s, detail: null }));
  }
  async setStep(id: string, seq: number, status: StoredStep["status"], _at: string, detail?: string) {
    const step = this.operations.get(id)!.steps.find((s) => s.seq === seq);
    if (step) {
      step.status = status;
      if (detail !== undefined) step.detail = detail;
    }
  }
  async unfinishedOperations() {
    return [...this.operations.values()].filter((o) => o.status === "CONFIRMED" || o.status === "RUNNING").map((o) => ({ id: o.id }));
  }
  async refreshInstance(d: InstanceDetail, at: string) {
    const old = this.instances.get(d.id);
    this.instances.set(d.id, {
      ...(old ?? storedInstance({ auraId: d.id })),
      name: d.name,
      status: d.status,
      statusGroup: statusGroup(d.status),
      memory: d.memory ?? null,
      storage: d.storage ?? null,
      vectorOptimized: d.vector_optimized ?? null,
      graphAnalyticsPlugin: d.graph_analytics_plugin ?? null,
      syncedAt: at,
      deletedInAuraAt: null,
    });
  }
  async markInstanceDeleted(auraId: string, at: string) {
    const i = this.instances.get(auraId);
    if (i) i.deletedInAuraAt = at;
  }
  async recordCreatedInstance(operationId: string, created: CreatedInstance, r: CreateRequest, at: string) {
    this.instances.set(created.id, storedInstance({ auraId: created.id, name: r.name, status: "creating", statusGroup: "IN_PROGRESS", memory: r.memory, storage: r.storage, region: r.region, cloudProvider: r.cloudProvider, tier: r.type, tenantId: r.tenantId, syncedAt: at }));
    this.operations.get(operationId)!.targetId = created.id;
  }
}

export class FakeVault implements CredentialVault {
  calls: string[] = [];
  passwords = new Map<string, string>();
  failSave = false;
  async save(id: string, _user: string, password: string) {
    if (this.failSave) throw new Error("keychain unavailable");
    this.calls.push(`save:${id}`);
    this.passwords.set(id, password);
  }
  async link(id: string) {
    this.calls.push(`link:${id}`);
  }
  async delete(id: string) {
    this.calls.push(`delete:${id}`);
    this.passwords.delete(id);
  }
}
