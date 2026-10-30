import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { tierName } from '../lib/create';
import { Facet, facetCounts, Filterable, Filters, SORTS } from '../lib/filters';
import { cloudLabel } from '../lib/format';
import { STATUS_GROUPS } from '../lib/status';
import { useColors } from '../theme/colors';
import { Button } from './index';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  onClose: () => void;
  instances: readonly Filterable[];
  tenantNames: ReadonlyMap<string, string>;
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  resultCount: number;
};

export function Option({ label, count, checked, onPress, radio }: { label: string; count?: number; checked: boolean; onPress: () => void; radio?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.option}>
      <View style={[styles.box, radio && styles.radio, { borderColor: checked ? c.primary : c.muted, backgroundColor: checked ? c.primary : 'transparent' }]}>
        {checked && <Icon name="check" size={14} color={c.onPrimary} />}
      </View>
      <Text style={[styles.optionLabel, { color: c.text }]}>{label}</Text>
      {count !== undefined && <Text style={{ color: c.muted }}>{count}</Text>}
    </Pressable>
  );
}

const toggle = <T extends string>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

/** The filters and sort as a bottom sheet. Each option's count is what picking it would give, keeping the other filters. */
export function FilterSheet({ visible, onClose, instances, tenantNames, filters, onChange, onClear, resultCount }: Props) {
  const c = useColors();
  const live = instances.filter(i => filters.showRemoved || !i.deletedInAuraAt);
  const section = (facet: Facet, title: string, values: string[], label: (v: string) => string, key: 'tenants' | 'clouds' | 'tiers' | 'statuses') => {
    const counts = facetCounts(instances, filters, facet);
    if (values.length === 0) {
      return null;
    }
    return (
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.legend, { color: c.muted }]}>{title}</Text>
        {values.map(v => (
          <Option
            key={v}
            label={label(v)}
            count={counts.get(v) ?? 0}
            checked={(filters[key] as string[]).includes(v)}
            onPress={() => onChange({ [key]: toggle(filters[key] as string[], v) } as Partial<Filters>)}
          />
        ))}
      </View>
    );
  };
  const distinct = (pick: (i: Filterable) => string | null | undefined) => [...new Set(live.map(pick).filter((v): v is string => Boolean(v)))].sort();

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close filters" onPress={onClose} style={styles.scrim} />
      <View style={[styles.sheet, { backgroundColor: c.bg }]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: c.text }]}>Filters</Text>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Icon name="x" color={c.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.legend, { color: c.muted }]}>Sort</Text>
            {SORTS.map(s => (
              <Option key={s.key} radio label={s.label} checked={filters.sort === s.key} onPress={() => onChange({ sort: s.key })} />
            ))}
          </View>
          {section('tenants', 'Tenant', distinct(i => i.tenantId), id => tenantNames.get(id) ?? id, 'tenants')}
          {section('clouds', 'Cloud', distinct(i => i.cloudProvider), cloudLabel, 'clouds')}
          {section('tiers', 'Tier', distinct(i => i.tier), tierName, 'tiers')}
          {section('statuses', 'Status', STATUS_GROUPS.map(g => g.key), k => STATUS_GROUPS.find(g => g.key === k)!.label, 'statuses')}
          <View style={styles.section}>
            <Option label="Show instances removed from Aura" checked={filters.showRemoved} onPress={() => onChange({ showRemoved: !filters.showRemoved })} />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Clear all" variant="secondary" onPress={onClear} />
          <View style={styles.grow}>
            <Button label={`Show ${resultCount} ${resultCount === 1 ? 'instance' : 'instances'}`} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingHorizontal: 16, gap: 8 },
  section: { gap: 2, marginBottom: 8 },
  legend: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionLabel: { flex: 1, fontSize: 17 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radio: { borderRadius: 11 },
  footer: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 0 },
  grow: { flex: 1 },
});
