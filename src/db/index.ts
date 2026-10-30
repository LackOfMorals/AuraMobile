import { open } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from './migrations';
import { withDrizzleCompat } from './opSqliteCompat';
import * as schema from './schema';

// The file keeps its original name on purpose: renaming it would start every existing install with an empty database.
const client = open({ name: 'auramobile.db' });

migrate({
  exec: sql => {
    client.executeSync(sql);
  },
  userVersion: () => Number(client.executeSync('PRAGMA user_version').rows[0]?.user_version ?? 0),
});

export const db = drizzle(withDrizzleCompat(client), { schema });
export { client as rawClient, schema };
