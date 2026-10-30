/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { MIGRATIONS, migrate, MigrationTarget } from './migrations';
import * as schema from './schema';

function target(sqlite: DatabaseSync): MigrationTarget {
  return {
    exec: sql => sqlite.exec(sql),
    userVersion: () => Number((sqlite.prepare('PRAGMA user_version').get() as { user_version: number }).user_version),
  };
}

const tables = Object.values(schema).map(t => getTableConfig(t));

describe('migrations', () => {
  it('create every table and column the Drizzle schema declares', () => {
    const sqlite = new DatabaseSync(':memory:');
    migrate(target(sqlite));
    for (const t of tables) {
      const columns = (sqlite.prepare(`PRAGMA table_info(${t.name})`).all() as { name: string }[]).map(c => c.name);
      expect(columns.sort()).toEqual(t.columns.map(c => c.name).sort());
    }
  });

  it('record the version and do nothing when run again', () => {
    const sqlite = new DatabaseSync(':memory:');
    const db = target(sqlite);
    expect(migrate(db)).toBe(MIGRATIONS.length);
    expect(db.userVersion()).toBe(MIGRATIONS.length);
    expect(() => migrate(db)).not.toThrow();
    expect(db.userVersion()).toBe(MIGRATIONS.length);
  });

  it('upgrade an install already on the first version, keeping its instances and starting the export count at zero', () => {
    const sqlite = new DatabaseSync(':memory:');
    const db = target(sqlite);
    migrate(db, MIGRATIONS.slice(0, 1));
    expect(db.userVersion()).toBe(1);
    sqlite.exec("INSERT INTO instance (aura_id, tenant_id, name, status, status_group, has_stored_password, password_reveal_count) VALUES ('d1', 't1', 'orders-prod', 'running', 'READY', 1, 3)");
    expect(migrate(db)).toBe(MIGRATIONS.length);
    const row = sqlite.prepare("SELECT name, has_stored_password AS stored, password_reveal_count AS reveals, password_export_count AS exports FROM instance WHERE aura_id = 'd1'").get() as Record<string, unknown>;
    expect({ ...row }).toEqual({ name: 'orders-prod', stored: 1, reveals: 3, exports: 0 });
  });

  it('roll back a failing migration and keep the previous version', () => {
    const sqlite = new DatabaseSync(':memory:');
    const db = target(sqlite);
    expect(() => migrate(db, ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (x INTEGER); NOT SQL;'])).toThrow();
    expect(db.userVersion()).toBe(1);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'b'").get()).toBeUndefined();
  });
});
