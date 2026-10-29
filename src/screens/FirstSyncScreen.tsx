import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../state/session';
import { useColors } from '../theme/colors';
import { Banner, Button } from '../ui';

export function FirstSyncScreen() {
  const c = useColors();
  const { syncing, lastResult, syncNow, disconnect } = useSession();

  useEffect(() => {
    syncNow();
  }, [syncNow]);

  const failed = !syncing && lastResult?.status === 'FAILED';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>Reading your Aura account</Text>
        {failed ? (
          <>
            <Banner tone="danger">{lastResult?.error ?? 'The sync did not finish.'}</Banner>
            <Button label="Try again" onPress={syncNow} />
            <Button label="Start over" variant="secondary" onPress={disconnect} />
          </>
        ) : (
          <>
            <ActivityIndicator accessibilityLabel="Syncing" color={c.primary} size="large" />
            <Text style={{ color: c.muted }}>Fetching your projects and instances. This takes a few seconds.</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
});
