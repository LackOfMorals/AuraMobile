import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listOperations } from '../db/queries';
import { relativeTime } from '../lib/format';
import { kindLabel, matchesOperationFilter, OperationFilter, operationView } from '../lib/operations';
import type { RootStackParamList } from '../navigation/types';
import { useDbQuery } from '../state/useDbQuery';
import { usePullToRefresh } from '../state/usePullToRefresh';
import { useColors } from '../theme/colors';
import { StatusChip } from '../ui/StatusChip';
import { EmptyState } from '../ui/parts';

const FILTERS: { key: OperationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'planned', label: 'Planned' },
  { key: 'failed', label: 'Failed' },
];

/** The audit log: every change made from this app, newest first. */
export function OperationsScreen() {
  const c = useColors();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const all = useDbQuery(listOperations);
  const [filter, setFilter] = useState<OperationFilter>('all');
  const refreshControl = usePullToRefresh();
  const items = all?.filter(o => matchesOperationFilter(o.status, filter));

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Changes</Text>
      <View style={styles.chips}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.key }}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, { borderColor: filter === f.key ? c.primary : c.control, backgroundColor: filter === f.key ? c.primary : c.card }]}>
            <Text style={{ color: filter === f.key ? c.onPrimary : c.text, fontWeight: '600' }}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        data={items ?? []}
        keyExtractor={o => o.id}
        ListEmptyComponent={
          items ? (
            <EmptyState title={all?.length ? 'Nothing here' : 'No changes yet'}>
              <Text style={{ color: c.muted }}>{all?.length ? 'No change matches this filter.' : 'Changes you make to instances from this app will be listed here.'}</Text>
            </EmptyState>
          ) : undefined
        }
        renderItem={({ item }) => {
          const view = operationView(item.status);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => nav.navigate('Operation', { operationId: item.id })}
              style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>
                {kindLabel(item.kind)} · {item.subject}
              </Text>
              <StatusChip label={view.label} tone={view.tone} />
              <Text style={{ color: c.muted }}>{relativeTime(item.createdAt)}</Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', padding: 16, paddingBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  list: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  name: { fontSize: 17, fontWeight: '600' },
});
