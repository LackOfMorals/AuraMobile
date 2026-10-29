import { asc, isNull } from 'drizzle-orm';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, schema } from '../db';
import { cloudLabel, memoryAndStorage, relativeTime } from '../lib/format';
import { statusView } from '../lib/status';
import { useSession } from '../state/session';
import { useColors } from '../theme/colors';
import { Button } from '../ui';

type Row = typeof schema.instance.$inferSelect;

/** Placeholder for phase 6: proves the synced data is on the device. Replaced by the gallery. */
export function HomeScreen() {
  const c = useColors();
  const { mode, syncing, lastResult, syncNow, disconnect } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await db.select().from(schema.instance).where(isNull(schema.instance.deletedInAuraAt)).orderBy(asc(schema.instance.name)));
    setSyncedAt((await db.select().from(schema.account))[0]?.lastSyncAt ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load, lastResult]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={r => r.auraId}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Instances{mode === 'demo' ? ' (demo)' : ''}</Text>
            <Text style={{ color: c.muted }}>{syncedAt ? `Synced ${relativeTime(syncedAt)}` : 'Not synced yet'}</Text>
            <Button label={syncing ? 'Syncing…' : 'Sync now'} disabled={syncing} onPress={syncNow} variant="secondary" />
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Button label="Disconnect and clear data" variant="danger" onPress={disconnect} />
          </View>
        }
        renderItem={({ item }) => {
          const status = statusView(item.status);
          return (
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.name, { color: c.text }]}>{item.name}</Text>
              <Text style={{ color: c.muted }}>
                {status.label} · {cloudLabel(item.cloudProvider)} · {memoryAndStorage(item.memory, item.storage)}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  header: { gap: 8, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 16 },
});
