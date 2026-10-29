import type { DB } from '@op-engineering/op-sqlite';
import { withDrizzleCompat } from './opSqliteCompat';

const fake = {
  execute: jest.fn(async () => ({ rowsAffected: 1, rows: [] })),
  executeSync: jest.fn(() => ({ rowsAffected: 0, rows: [{ id: 'a' }, { id: 'b' }] })),
  executeRaw: jest.fn(async () => ({ rowsAffected: 0, rawRows: [['a'], ['b']], columnNames: ['id'] })),
};
const client = withDrizzleCompat(fake as unknown as DB) as unknown as Record<string, (...a: unknown[]) => unknown>;

describe('withDrizzleCompat', () => {
  it('maps executeAsync to the async execute', async () => {
    expect(await client.executeAsync!('insert', [1])).toEqual({ rowsAffected: 1, rows: [] });
    expect(fake.execute).toHaveBeenCalledWith('insert', [1]);
  });

  it('presents the sync execute with rows in _array', () => {
    const result = client.execute!('select', []) as { rows: { _array: unknown[]; length: number } };
    expect(result.rows._array).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(result.rows.length).toBe(2);
    expect(fake.executeSync).toHaveBeenCalledWith('select', []);
  });

  it('maps executeRawAsync to the raw rows', async () => {
    expect(await client.executeRawAsync!('select', [])).toEqual([['a'], ['b']]);
  });
});
