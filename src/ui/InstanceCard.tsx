import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import type { InstanceRecord } from '../db/queries';
import { tierName } from '../lib/create';
import { cloudLabel, size } from '../lib/format';
import { useColors } from '../theme/colors';
import { StatusChip } from './StatusChip';
import { TierStripe } from './TierStripe';

type Props = { instance: InstanceRecord; layout: 'tile' | 'row'; onPress: () => void };

/**
 * A tier-coloured stripe, then the name, status, memory, storage, cloud and region. "tile" is a fixed width, for the home rows;
 * "row" fills the width, for the instance list. Nothing is cut off: long names and regions wrap.
 */
export function InstanceCard({ instance, layout, onPress }: Props) {
  const c = useColors();
  const removed = instance.deletedInAuraAt !== null;
  const cloud = [instance.cloudProvider ? cloudLabel(instance.cloudProvider) : '', instance.region].filter(Boolean).join(' · ');
  const label = [instance.name, removed ? 'removed from Aura' : instance.status, instance.tier ? tierName(instance.tier) : '', cloud].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.card, layout === 'tile' && styles.tile, { backgroundColor: c.card, borderColor: c.border }, removed && styles.removed]}>
      <TierStripe tier={instance.tier} />
      <View style={styles.body}>
        {instance.tier ? <Text style={[styles.tier, { color: c.text }]}>{tierName(instance.tier)}</Text> : null}
        <Text style={[styles.name, { color: c.text }]}>{instance.name}</Text>
        {removed ? <StatusChip label="Removed from Aura" tone="neutral" /> : <StatusChip status={instance.status} />}
        {instance.memory ? <Text style={[styles.details, { color: c.muted }]}>Memory {size(instance.memory)}</Text> : null}
        {instance.storage ? <Text style={[styles.details, { color: c.muted }]}>Storage {size(instance.storage)}</Text> : null}
        {cloud !== '' && <Text style={[styles.details, { color: c.muted }]}>{cloud}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  tile: { width: 190 },
  removed: { opacity: 0.6 },
  body: { padding: 12, gap: 6, alignItems: 'flex-start' },
  tier: { fontSize: 13, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '600' },
  details: { fontSize: 13 },
});
