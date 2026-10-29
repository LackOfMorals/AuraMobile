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

  it('roll back a failing migration and keep the previous version', () => {
    const sqlite = new DatabaseSync(':memory:');
    const db = target(sqlite);
    expect(() => migrate(db, ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (x INTEGER); NOT SQL;'])).toThrow();
    expect(db.userVersion()).toBe(1);
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'b'").get()).toBeUndefined();
  });
});
