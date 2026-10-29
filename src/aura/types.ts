// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Hand-written from the Aura API spec v1.2: only the fields this app reads or sends.

export type CloudProvider = "gcp" | "aws" | "azure";

export type AuraStatus =
  | "creating" | "destroying" | "running" | "pausing" | "paused" | "suspending" | "suspended"
  | "resuming" | "loading" | "loading failed" | "restoring" | "updating" | "overwriting";

export interface AuraCredentials {
  clientId: string;
  clientSecret: string;
}

export interface InstanceDetail {
  id: string;
  name: string;
  status: AuraStatus;
  connection_url: string;
  created_at: string;
  metrics_integration_url?: string;
  region: string;
  type: string;
  cloud_provider: CloudProvider;
  tenant_id: string;
  memory: string;
  storage: string;
  customer_managed_key_id?: string;
  /** Free instances only. */
  graph_nodes?: string;
  graph_relationships?: string;
  /** VDC instances only. */
  secondaries_count?: number;
  /** VDC and Business Critical only. */
  cdc_enrichment_mode?: "OFF" | "DIFF" | "FULL";
  vector_optimized?: boolean;
  graph_analytics_plugin?: boolean;
}

/** The list answer: no status or size. Those need getInstance. */
export interface InstanceSummary {
  id: string;
  name: string;
  tenant_id: string;
  cloud_provider: CloudProvider;
  created_at: string;
}

export interface InstanceConfigurationData {
  region: string;
  /** A human-friendly name for the region. */
  region_name: string;
  type: string;
  memory: string;
  storage: string;
  version: string;
  cloud_provider: CloudProvider;
}

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  instance_configurations: InstanceConfigurationData[];
}

/** What Aura's PATCH /instances/{id} accepts. Memory and storage are sent together by this app. */
export interface InstanceUpdate {
  name?: string;
  memory?: string;
  storage?: string;
  vector_optimized?: boolean;
  graph_analytics_plugin?: boolean;
}

/** What to send to create an instance. Optional fields are left out when not wanted. */
export interface InstanceCreate {
  version: string;
  region: string;
  memory: string;
  name: string;
  type: string;
  tenant_id: string;
  cloud_provider: string;
  storage?: string;
  vector_optimized?: boolean;
  graph_analytics_plugin?: boolean;
}

/** Aura's answer to a create. The password is shown here once and never again, so it must be stored before anything else is done. */
export interface CreatedInstance {
  id: string;
  connection_url: string;
  username: string;
  password: string;
}

export interface ClientStats {
  requests: number;
  retries: number;
  rateLimited: number;
}

/** What the rest of the app needs from Aura. The real client and the demo-mode mock both provide it. */
export interface AuraApi {
  /** Present on the real client, so a sync can report how many requests it made. */
  readonly stats?: ClientStats;
  resetStats?(): void;
  checkCredentials(): Promise<void>;
  listTenants(): Promise<ProjectSummary[]>;
  getTenant(tenantId: string): Promise<ProjectDetail>;
  listInstances(tenantId?: string): Promise<InstanceSummary[]>;
  getInstance(instanceId: string): Promise<InstanceDetail>;
  updateInstance(instanceId: string, changes: InstanceUpdate): Promise<{ status: number; instance?: InstanceDetail }>;
  createInstance(body: InstanceCreate): Promise<CreatedInstance>;
  deleteInstance(instanceId: string): Promise<void>;
  pauseInstance(instanceId: string): Promise<InstanceDetail>;
  resumeInstance(instanceId: string): Promise<InstanceDetail>;
}
