import Clipboard from '@react-native-clipboard/clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert } from 'react-native';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeOperationFor, getInstance, tenantNames } from '../db/queries';
import { tierName } from '../lib/create';
import { cloudLabel, formatDate, memoryAndStorage, relativeTime } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { UserError } from '../services/errors';
import { operations, useChangesAllowed, useSession } from '../state/session';
import { useDbQuery } from '../state/useDbQuery';
import { usePullToRefresh } from '../state/usePullToRefresh';
import { actionsLocked } from '../lib/status';
import { Banner, Button } from '../ui';
import { useColors } from '../theme/colors';
import { Icon } from '../ui/Icon';
import { Poster } from '../ui/InstanceCard';
import { PasswordField } from '../ui/PasswordField';
import { StatusChip } from '../ui/StatusChip';
import { EmptyState } from '../ui/parts';

const yesNo = (v: boolean | null) => (v === null ? null : v ? 'Yes' : 'No');

function Card({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  const c = useColors();
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return (
    <View style={styles.fact}>
      <Text style={{ color: c.muted }}>{label}</Text>
      <Text selectable style={[styles.factValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

export function DetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Detail'>) {
  const c = useColors();
  const { auraId } = route.params;
  const query = useCallback(() => getInstance(auraId), [auraId]);
  const instance = useDbQuery(query);
  const names = useDbQuery(tenantNames);
  const activeQuery = useCallback(() => activeOperationFor(auraId), [auraId]);
  const activeOperation = useDbQuery(activeQuery);
  const allowed = useChangesAllowed();
  const refreshOne = useSession(s => s.refreshOne);
  const refreshControl = usePullToRefresh(useCallback(() => refreshOne(auraId), [refreshOne, auraId]));
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (instance === undefined) {
    return <View style={[styles.screen, { backgroundColor: c.bg }]} />;
  }
  if (instance === null) {
    return (
      <View style={[styles.screen, styles.content, { backgroundColor: c.bg }]}>
        <EmptyState title="Instance not found">
          <Text style={{ color: c.muted }}>It is not in the stored copy. Sync from the Account tab and try again.</Text>
        </EmptyState>
      </View>
    );
  }
  const i = instance;
  const removed = i.deletedInAuraAt !== null;

  async function plan(kind: 'PAUSE' | 'RESUME' | 'DELETE') {
    try {
      // Planning sends nothing to Aura. A delete is only sent after the name is typed on the next screen.
      const { operationId } = kind === 'DELETE' ? await operations().planDelete(i.auraId) : await operations().plan(kind, i.auraId);
      navigation.navigate('Operation', { operationId });
    } catch (e) {
      Alert.alert('Cannot plan this change', e instanceof UserError ? e.message : 'Something went wrong.');
    }
  }

  function copyUrl() {
    Clipboard.setString(i.connectionUrl ?? '');
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} refreshControl={refreshControl}>
      <Poster name={i.name} cloud={i.cloudProvider} tier={i.tier} size={{ width: 160, height: 120 }} />
      <Text accessibilityRole="header" style={[styles.name, { color: c.text }]}>{i.name}</Text>
      {removed ? <StatusChip label="Removed from Aura" tone="neutral" /> : <StatusChip status={i.status} />}

      {activeOperation && (
        <View style={styles.actions}>
          <Banner tone="info">A change is in progress. This page updates by itself as Aura reports each stage.</Banner>
          <Button label="View progress" variant="secondary" onPress={() => navigation.navigate('Operation', { operationId: activeOperation })} />
        </View>
      )}

      {!removed && (
        <View style={styles.actions}>
          {i.status === 'paused' ? (
            <Button label="Resume" disabled={!allowed || actionsLocked(i.statusGroup)} onPress={() => plan('RESUME')} />
          ) : (
            <Button label="Pause" variant="secondary" disabled={!allowed || actionsLocked(i.statusGroup) || i.status !== 'running'} onPress={() => plan('PAUSE')} />
          )}
          <Button label="Edit" variant="secondary" disabled={!allowed || actionsLocked(i.statusGroup) || i.status !== 'running'} onPress={() => navigation.navigate('Edit', { auraId: i.auraId })} />
          <Button label="Delete" variant="danger" disabled={!allowed || actionsLocked(i.statusGroup)} onPress={() => plan('DELETE')} />
          {!allowed && <Banner tone="info">Changes are switched off for this account. Turn on "Allow changes" in the Account tab.</Banner>}
          {allowed && actionsLocked(i.statusGroup) && <Banner tone="info">Aura is working on this instance. Wait for it to finish.</Banner>}
        </View>
      )}

      {i.connectionUrl && (
        <Card title="Connection">
          <Text selectable style={{ color: c.text }}>{i.connectionUrl}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copied ? 'Copied' : 'Copy connection URL'}
            onPress={copyUrl}
            style={[styles.copy, { borderColor: c.primary }]}>
            <Icon name={copied ? 'check' : 'copy'} size={18} color={c.primary} />
            <Text style={{ color: c.primary, fontWeight: '600' }}>{copied ? 'Copied' : 'Copy URL'}</Text>
          </Pressable>
        </Card>
      )}

      {i.hasStoredPassword && !removed && (
        <Card title="Password">
          <PasswordField auraId={i.auraId} />
        </Card>
      )}

      <Card title="Properties">
        <Fact label="Tenant" value={names?.get(i.tenantId) ?? i.tenantId} />
        <Fact label="Cloud" value={cloudLabel(i.cloudProvider)} />
        <Fact label="Region" value={i.region} />
        <Fact label="Tier" value={i.tier ? tierName(i.tier) : null} />
        <Fact label="Memory and storage" value={memoryAndStorage(i.memory, i.storage)} />
        <Fact label="Vector optimised" value={yesNo(i.vectorOptimized)} />
        <Fact label="Graph analytics plugin" value={yesNo(i.graphAnalyticsPlugin)} />
        <Fact label="Secondaries" value={i.secondariesCount} />
        <Fact label="CDC enrichment" value={i.cdcEnrichmentMode} />
        <Fact label="Nodes" value={i.graphNodes} />
        <Fact label="Relationships" value={i.graphRelationships} />
        <Fact label="Customer-managed key" value={i.customerManagedKeyId} />
        <Fact label="Created" value={formatDate(i.createdAt)} />
        <Fact label="Aura id" value={i.auraId} />
      </Card>

      <Card title="Stored copy">
        <Text style={{ color: c.muted }}>
          {i.syncedAt ? `Last read from Aura ${relativeTime(i.syncedAt)}.` : 'Not read from Aura yet.'}
          {removed ? ' Aura no longer lists this instance. It is kept here so your history still makes sense.' : ''}
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 14 },
  name: { fontSize: 28, fontWeight: '800' },
  actions: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  factValue: { flexShrink: 1, textAlign: 'right', fontWeight: '500' },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
});
