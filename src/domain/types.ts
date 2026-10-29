export type InstanceStatusGroup = 'READY' | 'STOPPED' | 'IN_PROGRESS' | 'FAILED';

export type OperationKind = 'CREATE' | 'UPDATE' | 'DELETE' | 'PAUSE' | 'RESUME';

export type OperationStatus =
  | 'PLANNED'
  | 'CONFIRMED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export type StepStatus = 'PENDING' | 'ACTIVE' | 'DONE' | 'FAILED';

/** What an edit changes. Only the fields the person changed are present. */
export interface InstanceChange {
  name?: string;
  memory?: string;
  storage?: string;
  vectorOptimized?: boolean;
  graphAnalyticsPlugin?: boolean;
}

export interface InstanceCreate {
  tenantId: string;
  cloudProvider: string;
  region: string;
  type: string;
  memory: string;
  storage: string;
  name: string;
  vectorOptimized?: boolean;
  graphAnalyticsPlugin?: boolean;
}

export interface CreateVariables {
  input: InstanceCreate;
}
