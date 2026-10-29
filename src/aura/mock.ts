import { AuraApiError } from "./client";
import type {
  AuraApi, CreatedInstance, InstanceConfigurationData, InstanceCreate, InstanceDetail, InstanceSummary, InstanceUpdate, ProjectDetail, ProjectSummary,
} from "./types";

const TENANTS: ProjectSummary[] = [
  { id: "demo-tenant-1", name: "Demo project" },
  { id: "demo-tenant-2", name: "Sandbox" },
];

const CONFIGS: InstanceConfigurationData[] = [
  { cloud_provider: "gcp", region: "europe-west1", region_name: "Belgium (europe-west1)", type: "professional-db", memory: "4GB", storage: "16GB", version: "5" },
  { cloud_provider: "gcp", region: "europe-west1", region_name: "Belgium (europe-west1)", type: "professional-db", memory: "8GB", storage: "32GB", version: "5" },
  { cloud_provider: "aws", region: "eu-west-1", region_name: "Ireland (eu-west-1)", type: "professional-db", memory: "4GB", storage: "16GB", version: "5" },
  { cloud_provider: "azure", region: "westeurope", region_name: "Netherlands (westeurope)", type: "free-db", memory: "1GB", storage: "2GB", version: "5" },
];

function seed(): InstanceDetail[] {
  const base = { created_at: "2026-03-04T10:00:00Z" };
  return [
    { ...base, id: "d0000001", name: "orders-prod", status: "running", connection_url: "neo4j+s://d0000001.databases.neo4j.io", region: "europe-west1", type: "professional-db", cloud_provider: "gcp", tenant_id: "demo-tenant-1", memory: "8GB", storage: "32GB", vector_optimized: true, graph_analytics_plugin: false },
    { ...base, id: "d0000002", name: "orders-dev", status: "paused", connection_url: "neo4j+s://d0000002.databases.neo4j.io", region: "eu-west-1", type: "professional-db", cloud_provider: "aws", tenant_id: "demo-tenant-1", memory: "4GB", storage: "16GB", vector_optimized: false, graph_analytics_plugin: false },
    { ...base, id: "d0000003", name: "playground", status: "running", connection_url: "neo4j+s://d0000003.databases.neo4j.io", region: "westeurope", type: "free-db", cloud_provider: "azure", tenant_id: "demo-tenant-2", memory: "1GB", storage: "2GB", graph_nodes: "120", graph_relationships: "340" },
    { ...base, id: "d0000004", name: "analytics-restore", status: "loading failed", connection_url: "neo4j+s://d0000004.databases.neo4j.io", region: "europe-west1", type: "professional-db", cloud_provider: "gcp", tenant_id: "demo-tenant-2", memory: "4GB", storage: "16GB" },
  ];
}

const notFound = () => new AuraApiError(404, [{ message: "Instance not found" }]);

/**
 * An in-memory stand-in for Aura, for demo mode and tests. Nothing leaves the device. Changes take effect at once,
 * except that pause, resume, create and delete pass through their in-progress status first, as Aura's do.
 */
export class MockAura implements AuraApi {
  private instances = seed();
  private nextId = 5;

  async checkCredentials(): Promise<void> {}

  async listTenants(): Promise<ProjectSummary[]> {
    return TENANTS;
  }

  async getTenant(tenantId: string): Promise<ProjectDetail> {
    const tenant = TENANTS.find((t) => t.id === tenantId);
    if (!tenant) throw new AuraApiError(404, [{ message: "Project not found" }]);
    return { ...tenant, instance_configurations: CONFIGS };
  }

  async listInstances(tenantId?: string): Promise<InstanceSummary[]> {
    return this.instances
      .filter((i) => !tenantId || i.tenant_id === tenantId)
      .map(({ id, name, tenant_id, cloud_provider, created_at }) => ({ id, name, tenant_id, cloud_provider, created_at }));
  }

  async getInstance(instanceId: string): Promise<InstanceDetail> {
    const found = this.instances.find((i) => i.id === instanceId);
    if (!found) throw notFound();
    const seen = { ...found };
    this.settle(found);
    return seen;
  }

  async updateInstance(instanceId: string, changes: InstanceUpdate): Promise<{ status: number; instance?: InstanceDetail }> {
    const found = this.find(instanceId);
    Object.assign(found, changes);
    return { status: 200, instance: { ...found } };
  }

  async createInstance(body: InstanceCreate): Promise<CreatedInstance> {
    const id = `d${String(this.nextId++).padStart(7, "0")}`;
    const connection_url = `neo4j+s://${id}.databases.neo4j.io`;
    this.instances.push({
      id, name: body.name, status: "creating", connection_url, created_at: new Date().toISOString(), region: body.region, type: body.type,
      cloud_provider: body.cloud_provider as InstanceDetail["cloud_provider"], tenant_id: body.tenant_id, memory: body.memory, storage: body.storage ?? "",
      vector_optimized: body.vector_optimized, graph_analytics_plugin: body.graph_analytics_plugin,
    });
    return { id, connection_url, username: "neo4j", password: "demo-password-shown-once" };
  }

  async deleteInstance(instanceId: string): Promise<void> {
    this.find(instanceId).status = "destroying";
  }

  async pauseInstance(instanceId: string): Promise<InstanceDetail> {
    const found = this.find(instanceId);
    found.status = "pausing";
    return { ...found };
  }

  async resumeInstance(instanceId: string): Promise<InstanceDetail> {
    const found = this.find(instanceId);
    found.status = "resuming";
    return { ...found };
  }

  private find(instanceId: string): InstanceDetail {
    const found = this.instances.find((i) => i.id === instanceId);
    if (!found) throw notFound();
    return found;
  }

  /** An in-progress status is shown once, then the instance reaches its end state on the next read. */
  private settle(i: InstanceDetail): void {
    const next: Partial<Record<InstanceDetail["status"], InstanceDetail["status"]>> = { creating: "running", pausing: "paused", resuming: "running" };
    const to = next[i.status];
    if (to) i.status = to;
    if (i.status === "destroying") this.instances = this.instances.filter((x) => x !== i);
  }
}
