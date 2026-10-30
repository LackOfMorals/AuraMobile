/**
 * Plain SQL, one entry per schema version, applied in order and tracked with PRAGMA user_version.
 * Never edit an entry that has shipped: add a new one. schema.ts must describe the result
 * (migrations.test.ts checks that every column it declares exists).
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE account (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT,
    client_id_hint TEXT,
    status TEXT NOT NULL,
    connected_at TEXT,
    last_sync_at TEXT
  );
  CREATE TABLE tenant (
    aura_id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    configs_synced_at TEXT,
    synced_at TEXT
  );
  CREATE TABLE instance_configuration (
    key TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    cloud_provider TEXT NOT NULL,
    region TEXT NOT NULL,
    region_name TEXT NOT NULL,
    type TEXT NOT NULL,
    memory TEXT NOT NULL,
    storage TEXT NOT NULL,
    version TEXT NOT NULL,
    synced_at TEXT,
    PRIMARY KEY (tenant_id, key)
  );
  CREATE TABLE instance (
    aura_id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    status_group TEXT NOT NULL,
    connection_url TEXT,
    cloud_provider TEXT,
    region TEXT,
    tier TEXT,
    memory TEXT,
    storage TEXT,
    version TEXT,
    vector_optimized INTEGER,
    graph_analytics_plugin INTEGER,
    secondaries_count INTEGER,
    cdc_enrichment_mode TEXT,
    metrics_integration_url TEXT,
    graph_nodes INTEGER,
    graph_relationships INTEGER,
    customer_managed_key_id TEXT,
    created_at TEXT,
    synced_at TEXT,
    deleted_in_aura_at TEXT,
    has_stored_password INTEGER NOT NULL DEFAULT 0,
    password_reveal_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX instance_tenant_idx ON instance (tenant_id);
  CREATE TABLE operation (
    id TEXT PRIMARY KEY NOT NULL,
    instance_id TEXT,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    desired TEXT,
    before TEXT,
    diff TEXT,
    based_on_synced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    confirmed_at TEXT,
    finished_at TEXT,
    error TEXT
  );
  CREATE INDEX operation_instance_idx ON operation (instance_id);
  CREATE TABLE operation_step (
    operation_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL,
    at TEXT,
    detail TEXT,
    PRIMARY KEY (operation_id, seq)
  );
  CREATE TABLE sync_run (
    id TEXT PRIMARY KEY NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    tenants INTEGER,
    instances INTEGER,
    configurations INTEGER,
    requests INTEGER,
    retries INTEGER,
    error TEXT
  );
  `,
  // 2: audit count for Save to Files
  `
  ALTER TABLE instance ADD COLUMN password_export_count INTEGER NOT NULL DEFAULT 0;
  `,
];

/** The little a driver must offer, so migrations run the same on the device and in tests. */
export interface MigrationTarget {
  /** Runs one or more statements. */
  exec(sql: string): void;
  userVersion(): number;
}

/** Applies every migration the database has not seen. Each runs in a transaction, so a failure leaves the version unchanged. */
export function migrate(db: MigrationTarget, migrations: readonly string[] = MIGRATIONS): number {
  const start = db.userVersion();
  for (let v = start; v < migrations.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(migrations[v]!);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return migrations.length;
}
