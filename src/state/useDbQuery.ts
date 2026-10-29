import { useEffect, useState } from 'react';
import { useSession } from './session';

/**
 * Runs a stored-data query and runs it again after each sync, which is the only time stored data changes.
 * `query` should be a module-level function so it does not change between renders.
 */
export function useDbQuery<T>(query: () => Promise<T>): T | undefined {
  const [data, setData] = useState<T>();
  const syncedAt = useSession(s => s.lastResult);
  const version = useSession(s => s.dataVersion);

  useEffect(() => {
    let current = true;
    query().then(result => {
      if (current) {
        setData(result);
      }
    });
    return () => {
      current = false;
    };
  }, [query, syncedAt, version]);

  return data;
}
