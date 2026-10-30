import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Text } from '../ui/Text';
import { getEditContext } from '../db/queries';
import { FREE_DELETE_ONLY, isFreeTier } from '../lib/actions';
import { buildChange, EditForm, formFromInstance, MAX_NAME, nameError, nameLength, sizeKey, VECTOR_MIN_GB, vectorAllowed, vectorProblem } from '../lib/changes';
import { memoryAndStorage } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { UserError } from '../services/errors';
import { operations, useChangesAllowed } from '../state/session';
import { useDbQuery } from '../state/useDbQuery';
import { useColors } from '../theme/colors';
import { Banner, Button } from '../ui';
import { Dropdown } from '../ui/Dropdown';
import { EmptyState } from '../ui/parts';

/** Rename, resize, and the two switches. Only what changed is planned, and nothing is sent until the review is confirmed. */
export function EditScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Edit'>) {
  const c = useColors();
  const { auraId } = route.params;
  const allowed = useChangesAllowed();
  const query = useCallback(() => getEditContext(auraId), [auraId]);
  const context = useDbQuery(query);
  const [form, setForm] = useState<EditForm>();
  const [busy, setBusy] = useState(false);

  // Start the form from the stored instance once, so a background refresh never overwrites what is being typed
  useEffect(() => {
    if (context && !form) {
      setForm(formFromInstance(context.instance));
    }
  }, [context, form]);

  const change = useMemo(() => (context && form ? buildChange(context.instance, form) : undefined), [context, form]);

  if (context === null) {
    return (
      <View style={[styles.screen, styles.content, { backgroundColor: c.bg }]}>
        <EmptyState title="Instance not found" />
      </View>
    );
  }
  if (!context || !form || !change) {
    return <View style={[styles.screen, { backgroundColor: c.bg }]} />;
  }

  const { instance, sizes } = context;
  if (isFreeTier(instance.tier)) {
    return (
      <View style={[styles.screen, styles.content, { backgroundColor: c.bg }]}>
        <EmptyState title="Free instances cannot be edited">
          <Text style={{ color: c.muted }}>{FREE_DELETE_ONLY}</Text>
        </EmptyState>
      </View>
    );
  }
  const problem = nameError(form.name);
  // Vector can be turned on only if the instance has the memory now: a resize in the same change does not count
  const vectorOk = vectorAllowed(instance.memory);
  const vectorIssue = vectorProblem(instance, change.input);
  const patch = (p: Partial<EditForm>) => setForm({ ...form, ...p });

  async function review() {
    setBusy(true);
    try {
      const { operationId } = await operations().plan('UPDATE', auraId, change!.input);
      navigation.replace('Operation', { operationId });
    } catch (e) {
      Alert.alert('Cannot plan this change', e instanceof UserError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!allowed && <Banner tone="info">Changes are switched off for this account. Turn on "Allow changes" in the Account tab to send one.</Banner>}

      <Text style={[styles.label, { color: c.text }]}>Name</Text>
      <TextInput
        accessibilityLabel="Instance name"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={name => patch({ name })}
        style={[styles.input, { color: c.text, borderColor: problem ? c.danger : c.control, backgroundColor: c.card }]}
        value={form.name}
      />
      <Text style={{ color: problem ? c.danger : c.muted }}>{problem ?? `${nameLength(form.name)} of ${MAX_NAME} characters`}</Text>

      {sizes.length === 0 ? (
        <>
          <Text style={[styles.label, { color: c.text }]}>Size</Text>
          <Text style={{ color: c.muted }}>This tier has no other sizes to choose from.</Text>
        </>
      ) : (
        <Dropdown
          label="Size"
          value={form.size}
          options={sizes.map(s => ({ value: sizeKey(s), label: memoryAndStorage(s.memory, s.storage) }))}
          onChange={size => patch({ size })}
        />
      )}

      {instance.vectorOptimized !== null && (
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: c.text }]}>Vector optimised</Text>
          <Switch accessibilityLabel="Vector optimised" disabled={!vectorOk && !form.vectorOptimized} value={form.vectorOptimized ?? false} onValueChange={v => patch({ vectorOptimized: v })} />
        </View>
      )}
      {vectorIssue && <Text style={{ color: c.danger }}>{vectorIssue}</Text>}
      {instance.vectorOptimized !== null && !vectorOk && !vectorIssue && (
        <Text style={{ color: c.muted }}>Vector optimisation needs {VECTOR_MIN_GB} GB or more of memory. If you are resizing to {VECTOR_MIN_GB} GB or more, turn it on after the resize has finished.</Text>
      )}
      {instance.graphAnalyticsPlugin !== null && (
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: c.text }]}>Graph analytics plugin</Text>
          <Switch accessibilityLabel="Graph analytics plugin" value={form.graphAnalyticsPlugin ?? false} onValueChange={v => patch({ graphAnalyticsPlugin: v })} />
        </View>
      )}

      <Button label={busy ? 'Planning…' : 'Review changes'} disabled={busy || !change.changed || problem !== undefined || vectorIssue !== undefined} onPress={review} />
      {!change.changed && <Text style={{ color: c.muted }}>Change something to review it. Nothing is sent to Aura until you confirm.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 10 },
  label: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 17 },
  switchRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchLabel: { fontSize: 17 },
});
