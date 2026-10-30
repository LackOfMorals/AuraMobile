import { StyleSheet, Text as NativeText, type TextProps } from 'react-native';
import { maxScaleFor } from '../theme/typography';

/**
 * Text at 17 pt unless a style says otherwise. React Native's own default is 14 pt, below Apple's 17 pt default for body text.
 * Still scales with the Dynamic Type setting, like the native Text, except big headings, which stop at 1.6 times (see typography.ts).
 */
export function Text({ style, maxFontSizeMultiplier, ...rest }: TextProps) {
  const fontSize = StyleSheet.flatten(style)?.fontSize;
  return <NativeText {...rest} maxFontSizeMultiplier={maxFontSizeMultiplier ?? maxScaleFor(fontSize)} style={[styles.body, style]} />;
}

const styles = StyleSheet.create({
  body: { fontSize: 17 },
});
