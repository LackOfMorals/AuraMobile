import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useColors } from '../theme/colors';

/** A pressable tag: a facet value and how many instances it has. */
export function TagButton({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.tag, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={{ color: c.primary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** A slowly fading placeholder while stored data is read. */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: c.border, borderRadius: 12, opacity }, style]} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.empty, { borderColor: c.border }]}>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 20, gap: 12, alignItems: 'flex-start' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
});
