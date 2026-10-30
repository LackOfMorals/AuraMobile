import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../ui/Text';
import { getOperation } from '../db/queries';
import { elapsed, operationVerb, progressOf } from '../lib/changes';
import { operationView } from '../lib/operations';
import type { RootStackParamList } from '../navigation/types';
import { UserError } from '../services/errors';
import { operations, useChangesAllowed } from '../state/session';
import { useColors } from '../theme/colors';
import { Banner, Button } from '../ui';
import { Icon } from '../ui/Icon';
import { StatusChip } from '../ui/StatusChip';
import { EmptyState } from '../ui/parts';
import { readingColumn } from '../theme/layout';

type Loaded = NonNullable<Awaited<ReturnType<typeof getOperation>>>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

/** Plan, review, confirm, progress: one screen for the life of a change. */
export function OperationScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Operation'>) {
  const c = useColors();
  const { operationId } = route.params;
  const allowed = useChangesAllowed();
  const [op, setOp] = useState<Loaded | null | undefined>();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const reload = useCallback(async () => setOp(await getOperation(operationId)), [operationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const running = op?.status === 'CONFIRMED' || op?.status === 'RUNNING';
  // Read the operation again while it runs, and tick the clock for the elapsed time
  useEffect(() => {
    if (!running) {
      return;
    }
    const poll = setInterval(reload, 1500);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [running, reload]);

  if (op === undefined) {
    return <ActivityIndicator style={styles.loading} />;
  }
  if (op === null) {
    return (
      <View style={[styles.screen, styles.content, { backgroundColor: c.bg }]}>
        <EmptyState title="Change not found" />
      </View>
    );
  }

  const view = operationView(op.status);
  const isDelete = op.desired.kind === 'DELETE';
  const nameMatches = typed.trim() === op.before.name;
  const progress = progressOf(op.steps);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await operations().confirm(operationId, isDelete ? typed : null);
    } catch (e) {
      setError(e instanceof UserError ? e.message : 'Could not send the change.');
    }
    setBusy(false);
    reload();
  }

  async function cancel() {
    try {
      await operations().cancel(operationId);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof UserError ? e.message : 'Could not cancel the change.');
      reload();
    }
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
        {operationVerb(op.kind as never, op.plan.items)} {op.subject}
      </Text>
      <StatusChip label={view.label} tone={view.tone} />

      <Section title={op.status === 'PLANNED' ? 'What will change' : 'What changed'}>
        {op.plan.items.map(item => (
          <View key={item.field + item.label} style={styles.item}>
            <Text style={{ color: c.muted }}>{item.label}</Text>
            <Text style={[styles.itemValue, { color: c.text }]}>{item.before ? `${item.before}  →  ${item.after}` : item.after}</Text>
          </View>
        ))}
      </Section>

      {op.status === 'PLANNED' && op.plan.warnings.map(w => <Banner key={w} tone="warning">{w}</Banner>)}

      {op.status === 'PLANNED' && (
        <>
          {!allowed && <Banner tone="info">Changes are switched off for this account. Turn on "Allow changes" in the Account tab to send this.</Banner>}
          {isDelete && (
            <View style={styles.typed}>
              <Text style={{ color: c.text }}>Type <Text style={styles.bold}>{op.before.name}</Text> to confirm.</Text>
              <TextInput
                accessibilityLabel="Type the instance name to confirm deleting it"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setTyped}
                style={[styles.input, { color: c.text, borderColor: c.control, backgroundColor: c.card }]}
                value={typed}
              />
            </View>
          )}
          {error && <Banner tone="danger">{error}</Banner>}
          <Button
            label={busy ? 'Sending…' : isDelete ? 'Delete instance' : 'Confirm and send to Aura'}
            variant={isDelete ? 'danger' : 'primary'}
            disabled={busy || !allowed || (isDelete && !nameMatches)}
            onPress={confirm}
          />
          <Button label="Cancel" variant="secondary" onPress={cancel} />
        </>
      )}

      {op.steps.length > 0 && (
        <Section title={`Progress · ${progress.done} of ${progress.total}`}>
          {op.steps.map(step => (
            <View key={step.seq} style={styles.step}>
              {step.status === 'ACTIVE' ? (
                <ActivityIndicator color={c.primary} size="small" />
              ) : (
                <Icon name={step.status === 'DONE' ? 'check' : step.status === 'FAILED' ? 'alert' : 'dot'} size={18} color={step.status === 'DONE' ? c.tone.ok.fg : step.status === 'FAILED' ? c.danger : c.muted} />
              )}
              <View style={styles.stepText}>
                <Text style={{ color: step.status === 'PENDING' ? c.muted : c.text }}>{step.label}</Text>
                {step.detail ? <Text style={{ color: c.muted, fontSize: 13 }}>{step.detail}</Text> : null}
              </View>
            </View>
          ))}
          <Text style={{ color: c.muted }}>Time taken {elapsed(op.confirmedAt, op.finishedAt, now)}</Text>
        </Section>
      )}

      {op.status === 'FAILED' && <Banner tone="danger">{op.error ?? 'The change failed.'}</Banner>}
      {op.status === 'SUCCEEDED' && <Banner tone="info">Done. The stored copy of the instance is up to date.</Banner>}
      {running && <Text style={{ color: c.muted }}>This keeps going if you leave this screen, as long as the app stays open.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1 },
  content: { padding: 16, gap: 14, ...readingColumn },
  title: { fontSize: 26, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  item: { gap: 2 },
  itemValue: { fontSize: 17, fontWeight: '600' },
  typed: { gap: 8 },
  bold: { fontWeight: '800' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 17 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepText: { flex: 1 },
});
