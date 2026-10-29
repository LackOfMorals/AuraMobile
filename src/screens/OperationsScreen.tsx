import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../theme/colors';
import { EmptyState } from '../ui/parts';

/** Placeholder until the operations engine lands. */
export function OperationsScreen() {
  const c = useColors();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>
      <EmptyState title="No changes yet">
        <Text style={{ color: c.muted }}>Changes you make to instances from this app will be listed here.</Text>
      </EmptyState>
    </SafeAreaView>
  );
}
