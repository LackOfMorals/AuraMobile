import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { version } from '../../package.json';
import { db, schema } from '../db';
import { LABS_TERMS_URL, PRIVACY_URL, SUPPORT_URL } from '../legal/links';
import type { RootStackParamList } from '../navigation/types';
import { lastSyncedAt } from '../db/queries';
import { relativeTime } from '../lib/format';
import { useSession } from '../state/session';
import { useDbQuery } from '../state/useDbQuery';
import { usePullToRefresh } from '../state/usePullToRefresh';
import { useColors } from '../theme/colors';
import { Banner, Button } from '../ui';
import { readingColumn } from '../theme/layout';

const account = async () => (await db.select().from(schema.account))[0];

/** Connection details, sync, and disconnect. Credential replacement and sync history come in a later phase. */
export function AccountScreen() {
  const c = useColors();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { mode, syncing, lastResult, syncNow, disconnect, allowChanges, setAllowChanges } = useSession();
  const row = useDbQuery(account);
  const synced = useDbQuery(lastSyncedAt);
  const refreshControl = usePullToRefresh();

  function confirmDisconnect() {
    Alert.alert('Disconnect and clear data?', 'This removes your Aura credentials and the stored copy of your account from this device. Nothing changes in Aura.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: disconnect },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Aura account</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.muted }}>Mode</Text>
          <Text style={[styles.value, { color: c.text }]}>{mode === 'demo' ? 'Demo (sample data, nothing sent to Aura)' : 'Connected to Aura'}</Text>
          {row?.clientIdHint ? (
            <>
              <Text style={{ color: c.muted }}>Client ID</Text>
              <Text style={[styles.value, { color: c.text }]}>{row.clientIdHint}</Text>
            </>
          ) : null}
          <Text style={{ color: c.muted }}>Last synced</Text>
          <Text style={[styles.value, { color: c.text }]}>{synced ? relativeTime(synced) : 'Never'}</Text>
        </View>
        {mode === 'live' && (
          <View style={[styles.card, styles.switchRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.switchText}>
              <Text style={[styles.value, { color: c.text, marginBottom: 2 }]}>Allow changes</Text>
              <Text style={{ color: c.muted }}>
                Off keeps this account read-only: you can look but not pause, resume, edit, create or delete. Turn it on only when you mean to change something.
              </Text>
            </View>
            <Switch accessibilityLabel="Allow changes to your Aura account" onValueChange={setAllowChanges} value={allowChanges} />
          </View>
        )}
        {lastResult?.status === 'FAILED' && <Banner tone="danger">{lastResult.error ?? 'The last sync failed.'}</Banner>}
        {lastResult?.status === 'SLOWED' && <Banner tone="info">Aura asked us to slow down, so the last sync took longer than usual.</Banner>}
        <Button label={syncing ? 'Syncing…' : 'Sync now'} disabled={syncing} onPress={syncNow} />
        <Button label="Disconnect and clear data" variant="danger" onPress={confirmDisconnect} />

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text accessibilityRole="header" style={[styles.value, { color: c.text, marginBottom: 2 }]}>About</Text>
          <Text style={{ color: c.text }}>Jax {version}</Text>
          <Text style={{ color: c.muted, marginBottom: 8 }}>Allows you to manage your Neo4j Aura infrastructure</Text>
          <Text style={{ color: c.muted, marginBottom: 8 }}>{'Jax falls under the same terms as Neo4j Labs projects: it is experimental, and provided without warranties, support or service commitments, and is not intended for production use.'}</Text>
          <Button label="Neo4j Labs terms" variant="secondary" onPress={() => Linking.openURL(LABS_TERMS_URL)} />
          <Button label="Privacy policy" variant="secondary" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Button label="Support and feedback" variant="secondary" onPress={() => Linking.openURL(SUPPORT_URL)} />
          <Button label="Open source licences" variant="secondary" onPress={() => nav.navigate('Licenses')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 14, ...readingColumn },
  title: { fontSize: 28, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  value: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1 },
});
