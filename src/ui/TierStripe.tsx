import { StyleSheet, View } from 'react-native';
import { tierStripe } from '../lib/tierStripe';

/** The colour stripe that says which Aura tier an instance is. Decorative: the tier name is in the text around it. */
export function TierStripe({ tier }: { tier?: string | null }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.stripe, { backgroundColor: tierStripe(tier).color }]} />;
}

const styles = StyleSheet.create({
  stripe: { height: 8, alignSelf: 'stretch' },
});
