import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useColors } from '../theme/colors';
import { Option } from './FilterSheet';
import { Icon } from './Icon';

export type DropdownOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

/** A field that shows the choice and opens a list of options. Native pickers are avoided so no extra native module is needed. */
export function Dropdown({ label, value, options, onChange, placeholder = 'Choose…', disabled }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${selected ? selected.label : 'not chosen'}`}
        accessibilityHint="Opens a list of choices"
        accessibilityState={{ disabled: Boolean(disabled), expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: c.control, backgroundColor: c.card }, disabled && styles.disabled]}>
        <Text numberOfLines={1} style={[styles.value, { color: selected ? c.text : c.muted }]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Icon name="chevron-down" color={c.muted} />
      </Pressable>

      <Modal animationType="slide" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close list" onPress={() => setOpen(false)} style={styles.scrim} />
        <View style={[styles.sheet, { backgroundColor: c.bg }]}>
          <View style={styles.head}>
            <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{label}</Text>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}>
              <Icon name="x" color={c.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {options.map(o => (
              <Option
                key={o.value}
                radio
                label={o.label}
                checked={o.value === value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 17, fontWeight: '700' },
  field: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  disabled: { opacity: 0.5 },
  value: { flex: 1, fontSize: 17 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16 },
});
