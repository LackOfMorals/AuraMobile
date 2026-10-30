import { useCallback, useState } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { useColors } from '../theme/colors';
import { useSession } from './session';

/**
 * Pull to refresh for a list or page: reads Aura again. `refresh` decides what to read; by default it is the full sync
 * that the Sync now button runs. A failure is told to the person, not swallowed.
 */
export function usePullToRefresh(refresh?: () => Promise<string | null>) {
  const c = useColors();
  const syncNow = useSession(s => s.syncNow);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      let failure: string | null;
      if (refresh) {
        failure = await refresh();
      } else {
        const result = await syncNow();
        failure = result?.status === 'FAILED' ? (result.error ?? 'The sync did not finish.') : null;
      }
      if (failure) {
        Alert.alert('Could not refresh from Aura', failure);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refresh, syncNow]);

  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />;
}
