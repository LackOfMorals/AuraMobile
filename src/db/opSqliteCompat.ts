import type { DB } from '@op-engineering/op-sqlite';
import type { drizzle } from 'drizzle-orm/op-sqlite';

/**
 * drizzle-orm's op-sqlite driver (0.45 and the 1.0 betas) was written for op-sqlite's old API,
 * where `execute` was synchronous with rows in `rows._array`, and the async calls were
 * `executeAsync` and `executeRawAsync`. op-sqlite 19 renamed them: `execute` is async,
 * `executeSync` is the sync one, `rows` is a plain array and `executeRaw` returns `rawRows`.
 * This presents the new client in the old shape. Remove it once Drizzle catches up.
 */
type Params = Parameters<DB['execute']>[1];

/** What drizzle() accepts, which its types still call by op-sqlite's old name. */
export type DrizzleClient = Parameters<typeof drizzle>[0];

export function withDrizzleCompat(client: DB): DrizzleClient {
  return {
    executeAsync: (sql: string, params?: Params) => client.execute(sql, params),
    execute: (sql: string, params?: Params) => {
      const result = client.executeSync(sql, params);
      return { ...result, rows: { _array: result.rows, length: result.rows.length } };
    },
    executeRawAsync: async (sql: string, params?: Params) => (await client.executeRaw(sql, params)).rawRows,
  } as unknown as DrizzleClient;
}
