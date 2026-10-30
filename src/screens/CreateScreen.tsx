import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Text } from '../ui/Text';
import { getCreateOptions } from '../db/queries';
import { MAX_NAME, nameError, nameLength, sizeKey, VECTOR_MIN_GB, vectorAllowed } from '../lib/changes';
import {
  choose, Choice, cloudsOf, createVariables, EMPTY_CHOICE, FREE_OFFER, firstOpenStep, isFree, offersFor, regionsOf, sizesOf, Step, STEP_TITLE, stepDone,
  stepsFor, tenantsOffering, tierName, tiersIn, withFreeTier,
} from '../lib/create';
import { cloudLabel, memoryAndStorage } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { UserError } from '../services/errors';
import { operations } from '../state/session';
import { useDbQuery } from '../state/useDbQuery';
import { useColors } from '../theme/colors';
import { Banner, Button } from '../ui';
import { Dropdown } from '../ui/Dropdown';
import { Option } from '../ui/FilterSheet';
import { EmptyState } from '../ui/parts';
import { readingColumn } from '../theme/layout';

/**
 * The tier comes first, because it decides the rest. AuraDB Free fixes cloud, region and size, so choosing it
 * skips straight to the tenant and the name. Every list is built from what is on offer, so an invalid request cannot be made.
 */
export function CreateScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Create'>) {
  const c = useColors();
  const options = useDbQuery(getCreateOptions);
  const [choice, setChoice] = useState<Choice>(EMPTY_CHOICE);
  const [step, setStep] = useState<Step>('tier');
  const [busy, setBusy] = useState(false);

  // Free is not in a tenant's configurations, so it is added here, unless the account already has its one Free instance
  const all = useMemo(() => withFreeTier(options?.offers ?? [], options?.hasFreeInstance ?? false), [options]);
  const mine = useMemo(() => offersFor(all, choice.tenant), [all, choice.tenant]);
  const ofType = useMemo(() => mine.filter(o => o.type === choice.type), [mine, choice.type]);

  // A single tenant needs no question
  useEffect(() => {
    if (options?.tenants.length === 1 && choice.tenant === '') {
      setChoice(ch => choose(ch, { tenant: options.tenants[0]!.id }));
    }
  }, [options, choice.tenant]);

  // When there is only one size, choose it
  useEffect(() => {
    if (step !== 'size' || choice.size !== '') {
      return;
    }
    const only = sizesOf(mine, choice.cloud, choice.region, choice.type);
    if (only.length === 1) {
      setChoice(ch => choose(ch, { size: sizeKey(only[0]!) }));
    }
  }, [step, choice.size, choice.cloud, choice.region, choice.type, mine]);

  if (!options) {
    return <View style={[styles.screen, { backgroundColor: c.bg }]} />;
  }
  if (options.tenants.length === 0) {
    return (
      <View style={[styles.screen, styles.content, { backgroundColor: c.bg }]}>
        <EmptyState title="Nothing to create in yet">
          <Text style={{ color: c.muted }}>Sync first so this app knows your tenants and what each can create.</Text>
        </EmptyState>
      </View>
    );
  }

  // The steps this choice needs, without the tenant question when there is only one tenant
  const steps = stepsFor(choice).filter(s => !(s === 'tenant' && options.tenants.length === 1));
  const index = Math.max(0, steps.indexOf(step));
  const done = stepDone(step, choice, all);
  const update = (patch: Partial<Choice>) => setChoice(choose(choice, patch));
  const nameProblem = nameError(choice.name);
  const choiceMemory = choice.size.split('|')[0] ?? '';
  const vectorOk = vectorAllowed(choiceMemory);

  async function review() {
    const vars = createVariables(choice, all);
    if (!vars) {
      const open = firstOpenStep(choice, all);
      if (open) setStep(open);
      return;
    }
    setBusy(true);
    try {
      const { operationId } = await operations().planCreate(vars.input);
      navigation.replace('Operation', { operationId });
    } catch (e) {
      Alert.alert('Cannot plan this', e instanceof UserError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={{ color: c.muted }}>Step {index + 1} of {steps.length}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{STEP_TITLE[step]}</Text>

      {step === 'tier' && (
        <>
          <Dropdown
            label="Tier"
            value={choice.type}
            options={tiersIn(all).map(t => ({ value: t, label: tierName(t) }))}
            onChange={type => update({ type })}
          />
          {isFree(choice.type) && (
            <Banner tone="info">
              {`AuraDB Free is always ${cloudLabel(FREE_OFFER.cloudProvider)} in ${FREE_OFFER.regionName}, with ${memoryAndStorage(FREE_OFFER.memory, FREE_OFFER.storage)}. The only things left to choose are the tenant and a name.`}
            </Banner>
          )}
          {options.hasFreeInstance && <Text style={{ color: c.muted }}>AuraDB Free is not listed because you already have a Free instance. Aura allows one.</Text>}
        </>
      )}

      {step === 'tenant' &&
        tenantsOffering(all, options.tenants, choice.type).map(t => (
          <Option key={t.id} radio label={t.name} checked={choice.tenant === t.id} onPress={() => update({ tenant: t.id })} />
        ))}

      {step === 'cloud' && cloudsOf(ofType).map(cl => <Option key={cl} radio label={cloudLabel(cl)} checked={choice.cloud === cl} onPress={() => update({ cloud: cl })} />)}

      {step === 'region' && (
        <Dropdown
          label="Region"
          value={choice.region}
          options={regionsOf(ofType, choice.cloud).map(r => ({ value: r.region, label: r.regionName }))}
          onChange={region => update({ region })}
        />
      )}

      {step === 'size' && (
        <Dropdown
          label="Size"
          value={choice.size}
          options={sizesOf(mine, choice.cloud, choice.region, choice.type).map(sz => ({ value: sizeKey(sz), label: memoryAndStorage(sz.memory, sz.storage) }))}
          onChange={size => update({ size })}
        />
      )}

      {step === 'name' && (
        <>
          <TextInput
            accessibilityLabel="Instance name"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={name => update({ name })}
            placeholder="Name"
            placeholderTextColor={c.muted}
            style={[styles.input, { color: c.text, borderColor: choice.name && nameProblem ? c.danger : c.control, backgroundColor: c.card }]}
            value={choice.name}
          />
          <Text style={{ color: choice.name && nameProblem ? c.danger : c.muted }}>
            {choice.name && nameProblem ? nameProblem : `${nameLength(choice.name)} of ${MAX_NAME} characters`}
          </Text>
          {!isFree(choice.type) && (
            <>
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: c.text }]}>Vector optimised</Text>
                <Switch accessibilityLabel="Vector optimised" disabled={!vectorOk} value={choice.vectorOptimized} onValueChange={v => update({ vectorOptimized: v })} />
              </View>
              {!vectorOk && <Text style={{ color: c.muted }}>Vector optimisation needs {VECTOR_MIN_GB} GB or more of memory. This size has {choiceMemory}.</Text>}
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: c.text }]}>Graph analytics plugin</Text>
                <Switch accessibilityLabel="Graph analytics plugin" value={choice.graphAnalyticsPlugin} onValueChange={v => update({ graphAnalyticsPlugin: v })} />
              </View>
            </>
          )}
        </>
      )}

      <View style={styles.bar}>
        {index > 0 && <Button label="Back" variant="secondary" onPress={() => setStep(steps[index - 1]!)} />}
        <View style={styles.grow}>
          {step === 'name' ? (
            <Button label={busy ? 'Planning…' : 'Review'} disabled={!done || busy} onPress={review} />
          ) : (
            <Button label="Continue" disabled={!done} onPress={() => setStep(steps[index + 1]!)} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 10, ...readingColumn },
  title: { fontSize: 26, fontWeight: '800' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 17 },
  switchRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 17 },
  bar: { flexDirection: 'row', gap: 12, marginTop: 12 },
  grow: { flex: 1 },
});
