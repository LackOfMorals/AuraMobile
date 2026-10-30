import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InstanceRecord, listInstances, tenantNames } from '../db/queries';
import { Filters } from '../lib/filters';
import { cloudLabel, plural } from '../lib/format';
import { summarize, Tag } from '../lib/home';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { useDbQuery } from '../state/useDbQuery';
import { usePullToRefresh } from '../state/usePullToRefresh';
import { useFilters } from '../state/filtersStore';
import { useChangesAllowed, useSession } from '../state/session';
import { useColors } from '../theme/colors';
import { Button } from '../ui';
import { InstanceCard } from '../ui/InstanceCard';
import { EmptyState, Skeleton, TagButton } from '../ui/parts';

type Nav = BottomTabNavigationProp<TabParamList, 'Home'> & NativeStackNavigationProp<RootStackParamList>;

function TagGroup({ label, tags, onPick }: { label: string; tags: Tag[]; onPick: (value: string) => void }) {
  const c = useColors();
  if (tags.length === 0) {
    return null;
  }
  return (
    <View style={styles.tagGroup}>
      <Text style={[styles.legend, { color: c.muted }]}>{label}</Text>
      <View style={styles.tagRow}>
        {tags.map(t => (
          <TagButton key={t.value} label={`${t.label} · ${t.count}`} onPress={() => onPick(t.value)} />
        ))}
      </View>
    </View>
  );
}

function Row({ title, items, onSeeAll, onOpen }: { title: string; items: InstanceRecord[]; onSeeAll: () => void; onOpen: (id: string) => void }) {
  const c = useColors();
  if (items.length === 0) {
    return null;
  }
  return (
    <View style={styles.rowBlock}>
      <View style={styles.rowHead}>
        <Text accessibilityRole="header" style={[styles.rowTitle, { color: c.text }]}>{title}</Text>
        <Button label="See all" variant="secondary" onPress={onSeeAll} />
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cards}
        data={items}
        keyExtractor={i => i.auraId}
        renderItem={({ item }) => <InstanceCard instance={item} layout="tile" onPress={() => onOpen(item.auraId)} />}
      />
    </View>
  );
}

/** Hero with search and tags, then rows of cards, like the web console's home page. */
export function HomeScreen() {
  const c = useColors();
  const nav = useNavigation<Nav>();
  const replaceFilters = useFilters(s => s.replace);
  const { syncing, syncNow } = useSession();
  const allowed = useChangesAllowed();
  const instances = useDbQuery(listInstances);
  const names = useDbQuery(tenantNames);
  const [q, setQ] = useState('');
  const refreshControl = usePullToRefresh();

  const summary = useMemo(() => (instances && names ? summarize(instances, names, cloudLabel) : undefined), [instances, names]);

  const browse = (filters: Partial<Filters>) => {
    replaceFilters(filters);
    nav.navigate('Instances');
  };
  const open = (auraId: string) => nav.navigate('Detail', { auraId });

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
        <Text style={[styles.eyebrow, { color: c.primary }]}>Your Aura account</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Find an instance</Text>
        <Text style={{ color: c.muted }}>
          {summary ? `${plural(summary.total, 'instance')} across ${plural(summary.tenants.length, 'tenant')}` : 'Reading the stored copy of your account…'}
        </Text>
        <Button label="New instance" variant="secondary" disabled={!allowed} onPress={() => nav.navigate('Create')} />
        {!allowed && <Text style={{ color: c.muted }}>Turn on "Allow changes" in the Account tab to create instances.</Text>}
        <TextInput
          accessibilityLabel="Search instances by name"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQ}
          onSubmitEditing={() => browse({ q: q.trim() })}
          placeholder="Search by name"
          placeholderTextColor={c.muted}
          returnKeyType="search"
          style={[styles.search, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
          value={q}
        />
        {summary && (
          <>
            <TagGroup label="Tenant" tags={summary.tenants} onPick={v => browse({ tenants: [v] })} />
            <TagGroup label="Cloud" tags={summary.clouds} onPick={v => browse({ clouds: [v] })} />
            <TagGroup label="Tier" tags={summary.tiers} onPick={v => browse({ tiers: [v] })} />
          </>
        )}
        {!summary && (
          <View style={styles.cards}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} style={styles.skeleton} />
            ))}
          </View>
        )}
        {summary && (
          <>
            <Row title="In progress" items={summary.inProgress} onSeeAll={() => browse({ statuses: ['IN_PROGRESS'] })} onOpen={open} />
            <Row title="Running" items={summary.running} onSeeAll={() => browse({ statuses: ['READY'] })} onOpen={open} />
          </>
        )}
        {summary?.total === 0 && (
          <EmptyState title="No instances yet">
            <Text style={{ color: c.muted }}>Instances in your Aura account appear here after a sync. If you have none in Aura, there is nothing to show.</Text>
            <Button label={syncing ? 'Syncing…' : 'Sync now'} disabled={syncing} onPress={syncNow} />
          </EmptyState>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 14 },
  eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 32, fontWeight: '800' },
  search: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  tagGroup: { gap: 6 },
  legend: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBlock: { gap: 8, marginTop: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 20, fontWeight: '700' },
  cards: { flexDirection: 'row', gap: 12 },
  skeleton: { width: 168, height: 190 },
});
