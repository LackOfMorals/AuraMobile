// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import type { CreatedInstance, InstanceDetail } from "../../aura/types";
import type { Changes, Plan, Snapshot } from "./diff";
import type { CreateRequest, OperationKind, OperationStatus } from "./state";
import type { OfferedConfiguration } from "./plan";

/** An instance as the operations see it: the stored copy, with what a plan depends on. */
export interface StoredInstance extends Snapshot {
  auraId: string;
  statusGroup: "READY" | "STOPPED" | "IN_PROGRESS" | "FAILED";
  region: string | null;
  cloudProvider: string | null;
  tier: string | null;
  tenantId: string | null;
  syncedAt: string | null;
  deletedInAuraAt: string | null;
}

export interface StoredStep {
  seq: number;
  label: string;
  status: "PENDING" | "ACTIVE" | "DONE" | "FAILED";
  detail: string | null;
}

export interface StoredOperation {
  id: string;
  kind: string;
  status: OperationStatus;
  desired: { kind: OperationKind; changes?: Changes; create?: CreateRequest };
  before: Snapshot;
  plan: Plan;
  basedOnSyncedAt: string | null;
  /** The instance this is about. A create has none until Aura has made one. */
  targetId: string | null;
  steps: StoredStep[];
  createdAt: string;
  confirmedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface NewOperation {
  kind: OperationKind;
  instance?: StoredInstance;
  desired: object;
  before?: Snapshot;
  plan: Plan;
  at: string;
}

/** Where an instance's password is kept. Aura shows it once, so it is stored the moment it arrives. */
export interface CredentialVault {
  save(auraId: string, username: string, password: string): Promise<void>;
  /** Records that a password is stored for the instance. */
  link(auraId: string): Promise<void>;
  delete(auraId: string): Promise<void>;
}

/** Everything the operations read and write. The SQLite repository is the real one; tests use an in-memory one. */
export interface OperationStore {
  loadInstance(auraId: string): Promise<StoredInstance | null>;
  /** The memory and storage pairs offered for an instance's tenant, cloud, region and tier. */
  loadSizeOptions(instance: StoredInstance): Promise<{ memory: string; storage: string }[]>;
  loadOffered(tenantId: string): Promise<OfferedConfiguration[]>;
  loadTenantName(tenantId: string): Promise<string | null>;
  /** Whether the account has a Free instance that Aura still lists. Aura allows one. */
  hasFreeInstance(): Promise<boolean>;
  /** Operations that hold the instance: confirmed or running. */
  holdingOperations(auraId: string): Promise<{ id: string; status: OperationStatus }[]>;
  createOperation(input: NewOperation): Promise<string>;
  loadOperation(id: string): Promise<StoredOperation | null>;
  /** Moves an operation only if it is still in `from`, and says whether it did. This is what makes a second confirmation lose. */
  moveOperation(id: string, from: OperationStatus, to: OperationStatus, extra: { confirmedAt?: string; finishedAt?: string; error?: string }, at: string): Promise<boolean>;
  addSteps(id: string, steps: { seq: number; label: string; status: StoredStep["status"]; at?: string }[]): Promise<void>;
  setStep(id: string, seq: number, status: StoredStep["status"], at: string, detail?: string): Promise<void>;
  unfinishedOperations(): Promise<{ id: string }[]>;
  /** Brings one instance's stored copy up to date from what Aura just reported. */
  refreshInstance(detail: InstanceDetail, at: string): Promise<void>;
  /** The record stays, marked as gone, so the history does. */
  markInstanceDeleted(auraId: string, at: string): Promise<void>;
  /** Stores a freshly created instance and links the operation to it. */
  recordCreatedInstance(operationId: string, created: CreatedInstance, request: CreateRequest, at: string): Promise<void>;
}
