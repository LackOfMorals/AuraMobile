import { open } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from './migrations';
import * as schema from './schema';

const client = open({ name: 'auramobile.db' });

migrate({
  exec: sql => {
    client.executeSync(sql);
  },
  userVersion: () => Number(client.executeSync('PRAGMA user_version').rows[0]?.user_version ?? 0),
});

export const db = drizzle(client, { schema });
export { schema };
