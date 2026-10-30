import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { statusView, Tone } from '../lib/status';
import { useColors } from '../theme/colors';
import { Icon } from './Icon';

type Props = { status: string } | { label: string; tone: Tone };

/** Every status shows an icon and a word, so colour is never the only signal. */
export function StatusChip(props: Props) {
  const c = useColors();
  const view = 'status' in props ? statusView(props.status) : { label: props.label, tone: props.tone, icon: 'dot' as const };
  const tone = c.tone[view.tone];
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      {view.icon === 'spinner' ? <ActivityIndicator color={tone.fg} size="small" style={styles.spinner} /> : <Icon name={view.icon} size={12} color={tone.fg} />}
      <Text style={[styles.text, { color: tone.fg }]}>{view.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  text: { fontSize: 13, fontWeight: '600' },
  spinner: { transform: [{ scale: 0.6 }], width: 12, height: 12 },
});
