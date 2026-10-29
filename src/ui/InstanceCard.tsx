import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { InstanceRecord } from '../db/queries';
import { tierName } from '../lib/create';
import { cloudLabel, initials, memoryAndStorage } from '../lib/format';
import { posterStyle } from '../lib/poster';
import { useColors } from '../theme/colors';
import { StatusChip } from './StatusChip';

/** The generated poster: the cloud's colour, the instance's initials, its cloud and tier. No image files. */
export function Poster({ name, cloud, tier, size }: { name: string; cloud?: string | null; tier?: string | null; size: { width: number; height: number } }) {
  const { colors, angle } = posterStyle(cloud, name);
  return (
    <LinearGradient useAngle angle={angle} colors={colors} style={[styles.poster, size]}>
      <Text style={styles.posterSmall}>{cloudLabel(cloud)}</Text>
      <Text style={styles.letters}>{initials(name)}</Text>
      <Text numberOfLines={1} style={styles.posterSmall}>{tier ? tierName(tier) : ''}</Text>
    </LinearGradient>
  );
}

type Props = { instance: InstanceRecord; layout: 'tile' | 'row'; onPress: () => void };

/** "tile" is poster over text, for the home rows. "row" is a compact poster beside the text, for the gallery on a phone. */
export function InstanceCard({ instance, layout, onPress }: Props) {
  const c = useColors();
  const removed = instance.deletedInAuraAt !== null;
  const tile = layout === 'tile';
  const details = [instance.region, memoryAndStorage(instance.memory, null)].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${instance.name}, ${removed ? 'removed from Aura' : instance.status}`}
      onPress={onPress}
      style={[styles.card, tile ? styles.tile : styles.row, { backgroundColor: c.card, borderColor: c.border }, removed && styles.removed]}>
      <Poster name={instance.name} cloud={instance.cloudProvider} tier={instance.tier} size={tile ? { width: 168, height: 112 } : { width: 76, height: 96 }} />
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>{instance.name}</Text>
        {removed ? <StatusChip label="Removed from Aura" tone="neutral" /> : <StatusChip status={instance.status} />}
        {details !== '' && <Text numberOfLines={1} style={[styles.details, { color: c.muted }]}>{details}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  tile: { width: 168 },
  row: { flexDirection: 'row' },
  removed: { opacity: 0.6 },
  body: { flex: 1, padding: 10, gap: 6, justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '600' },
  details: { fontSize: 13 },
  poster: { padding: 8, justifyContent: 'space-between' },
  posterSmall: { color: '#fff', fontSize: 11, fontWeight: '600', opacity: 0.9 },
  letters: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
});
