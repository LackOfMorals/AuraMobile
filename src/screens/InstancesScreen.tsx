import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listInstances, tenantNames } from '../db/queries';
import { activeCount, matches, sortInstances } from '../lib/filters';
import { plural } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { useFilters } from '../state/filtersStore';
import { useDbQuery } from '../state/useDbQuery';
import { useColors } from '../theme/colors';
import { Button } from '../ui';
import { FilterSheet } from '../ui/FilterSheet';
import { Icon } from '../ui/Icon';
import { InstanceCard } from '../ui/InstanceCard';
import { EmptyState, Skeleton } from '../ui/parts';

export function InstancesScreen() {
  const c = useColors();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { filters, set, clear } = useFilters();
  const instances = useDbQuery(listInstances);
  const names = useDbQuery(tenantNames);
  const [sheet, setSheet] = useState(false);

  const results = useMemo(() => (instances ? sortInstances(instances.filter(i => matches(i, filters)), filters.sort) : undefined), [instances, filters]);
  const badge = activeCount(filters);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.bar}>
        <TextInput
          accessibilityLabel="Search instances by name"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={q => set({ q })}
          placeholder="Search by name"
          placeholderTextColor={c.muted}
          style={[styles.search, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
          value={filters.q}
        />
        <Pressable
          accessibilityLabel={badge ? `Filters, ${badge} on` : 'Filters'}
          accessibilityRole="button"
          onPress={() => setSheet(true)}
          style={[styles.filterButton, { borderColor: c.border, backgroundColor: c.card }]}>
          <Icon name="filter" color={c.primary} />
          {badge > 0 && (
            <View style={[styles.badge, { backgroundColor: c.primary }]}>
              <Text style={[styles.badgeText, { color: c.onPrimary }]}>{badge}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {!results && (
        <View style={styles.list}>
          {[0, 1, 2].map(i => (
            <Skeleton key={i} style={styles.skeleton} />
          ))}
        </View>
      )}
      {results && (
        <FlatList
          contentContainerStyle={styles.list}
          data={results}
          keyExtractor={i => i.auraId}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Text style={{ color: c.muted }}>{plural(results.length, 'instance')}</Text>}
          ListEmptyComponent={
            <EmptyState title="Nothing matches">
              <Text style={{ color: c.muted }}>No instance fits the search and filters.</Text>
              <Button label="Clear filters" variant="secondary" onPress={clear} />
            </EmptyState>
          }
          renderItem={({ item }) => <InstanceCard instance={item} layout="row" onPress={() => nav.navigate('Detail', { auraId: item.auraId })} />}
        />
      )}

      <FilterSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        instances={instances ?? []}
        tenantNames={names ?? new Map()}
        filters={filters}
        onChange={set}
        onClear={clear}
        resultCount={results?.length ?? 0}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  search: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  filterButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  list: { padding: 16, paddingTop: 8, gap: 12 },
  skeleton: { height: 96 },
});
