import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Timestamps are ISO-8601 text, as Aura sends them. Booleans are 0/1.
// No secrets live here: the client secret and instance passwords are in the Keychain.

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  label: text('label'),
  clientIdHint: text('client_id_hint'),
  status: text('status', { enum: ['CONNECTED', 'DISCONNECTED'] }).notNull(),
  connectedAt: text('connected_at'),
  lastSyncAt: text('last_sync_at'),
});

export const tenant = sqliteTable('tenant', {
  auraId: text('aura_id').primaryKey(),
  name: text('name').notNull(),
  configsSyncedAt: text('configs_synced_at'),
  syncedAt: text('synced_at'),
});

/** One combination of cloud, region, tier and size a tenant is offered. Feeds the create and edit pickers. */
export const instanceConfiguration = sqliteTable(
  'instance_configuration',
  {
    key: text('key').notNull(),
    tenantId: text('tenant_id').notNull(),
    cloudProvider: text('cloud_provider').notNull(),
    region: text('region').notNull(),
    regionName: text('region_name').notNull(),
    type: text('type').notNull(),
    memory: text('memory').notNull(),
    storage: text('storage').notNull(),
    version: text('version').notNull(),
    syncedAt: text('synced_at'),
  },
  t => [primaryKey({ columns: [t.tenantId, t.key] })],
);

export const instance = sqliteTable(
  'instance',
  {
    auraId: text('aura_id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    statusGroup: text('status_group', {
      enum: ['READY', 'STOPPED', 'IN_PROGRESS', 'FAILED'],
    }).notNull(),
    connectionUrl: text('connection_url'),
    cloudProvider: text('cloud_provider'),
    region: text('region'),
    tier: text('tier'),
    memory: text('memory'),
    storage: text('storage'),
    version: text('version'),
    vectorOptimized: integer('vector_optimized', { mode: 'boolean' }),
    graphAnalyticsPlugin: integer('graph_analytics_plugin', { mode: 'boolean' }),
    secondariesCount: integer('secondaries_count'),
    cdcEnrichmentMode: text('cdc_enrichment_mode'),
    metricsIntegrationUrl: text('metrics_integration_url'),
    graphNodes: integer('graph_nodes'),
    graphRelationships: integer('graph_relationships'),
    customerManagedKeyId: text('customer_managed_key_id'),
    createdAt: text('created_at'),
    syncedAt: text('synced_at'),
    /** Set when Aura stops listing the instance; it is kept so history still makes sense. */
    deletedInAuraAt: text('deleted_in_aura_at'),
    /** Whether a password is stored in the Keychain. The password itself never is here. */
    hasStoredPassword: integer('has_stored_password', { mode: 'boolean' }).notNull().default(false),
    passwordRevealCount: integer('password_reveal_count').notNull().default(0),
    /** How many times the connection details were saved to a file with Save to Files. A count only: nothing about the file or where it went. */
    passwordExportCount: integer('password_export_count').notNull().default(0),
  },
  t => [index('instance_tenant_idx').on(t.tenantId)],
);

export const operation = sqliteTable(
  'operation',
  {
    id: text('id').primaryKey(),
    /** Not a foreign key: after the stored copy is reset an operation can outlive its instance. */
    instanceId: text('instance_id'),
    kind: text('kind', {
      enum: ['CREATE', 'UPDATE', 'DELETE', 'PAUSE', 'RESUME'],
    }).notNull(),
    status: text('status', {
      enum: ['PLANNED', 'CONFIRMED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
    }).notNull(),
    desired: text('desired'),
    before: text('before'),
    diff: text('diff'),
    basedOnSyncedAt: text('based_on_synced_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at'),
    confirmedAt: text('confirmed_at'),
    finishedAt: text('finished_at'),
    error: text('error'),
  },
  t => [index('operation_instance_idx').on(t.instanceId)],
);

export const operationStep = sqliteTable(
  'operation_step',
  {
    operationId: text('operation_id').notNull(),
    seq: integer('seq').notNull(),
    label: text('label').notNull(),
    status: text('status', {
      enum: ['PENDING', 'ACTIVE', 'DONE', 'FAILED'],
    }).notNull(),
    at: text('at'),
    detail: text('detail'),
  },
  t => [primaryKey({ columns: [t.operationId, t.seq] })],
);

export const syncRun = sqliteTable('sync_run', {
  id: text('id').primaryKey(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status', {
    enum: ['RUNNING', 'SUCCEEDED', 'SLOWED', 'FAILED'],
  }).notNull(),
  tenants: integer('tenants'),
  instances: integer('instances'),
  configurations: integer('configurations'),
  requests: integer('requests'),
  retries: integer('retries'),
  error: text('error'),
});
