import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useColors } from '../theme/colors';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

/** 44pt minimum height, matching the web console's touch targets. */
export function Button({ label, onPress, variant = 'primary', disabled }: ButtonProps) {
  const c = useColors();
  const background = variant === 'primary' ? c.primary : 'transparent';
  const color = variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.danger : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { backgroundColor: background, borderColor: variant === 'primary' ? background : color }, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** "warning" has its own amber background and a thicker edge, so it does not look like any other box on the screen. */
export function Banner({ tone, children }: { tone: 'danger' | 'info' | 'warning'; children: ReactNode }) {
  const c = useColors();
  const color = tone === 'danger' ? c.danger : tone === 'warning' ? c.tone.warn.fg : c.primary;
  const warning = tone === 'warning';
  return (
    <View accessibilityRole="alert" style={[styles.banner, warning && styles.warning, { borderColor: color, backgroundColor: warning ? c.tone.warn.bg : c.card }]}>
      <Text style={{ color: c.text }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  buttonText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12 },
  warning: { borderWidth: 2 },
});
