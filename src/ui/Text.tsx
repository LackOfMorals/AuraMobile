import { StyleSheet, Text as NativeText, type TextProps } from 'react-native';

/**
 * Text at 17 pt unless a style says otherwise. React Native's own default is 14 pt, below Apple's 17 pt default for body text.
 * Still scales with the Dynamic Type setting, like the native Text.
 */
export function Text({ style, ...rest }: TextProps) {
  return <NativeText {...rest} style={[styles.body, style]} />;
}

const styles = StyleSheet.create({
  body: { fontSize: 17 },
});
