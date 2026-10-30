import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Text } from '../ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../state/session';
import { useColors } from '../theme/colors';
import { Banner, Button } from '../ui';

export function SetupScreen() {
  const c = useColors();
  const connect = useSession(s => s.connect);
  const startDemo = useSession(s => s.startDemo);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = clientId.trim() !== '' && clientSecret.trim() !== '';

  async function submit() {
    setBusy(true);
    setError(null);
    const failure = await connect({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  }

  const input = [styles.input, { color: c.text, borderColor: c.control, backgroundColor: c.card }];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: c.text }]}>Connect your Aura account</Text>
          <Text style={{ color: c.muted }}>
            Create API credentials in the Aura console (Account settings, API credentials). They are checked with Aura, then kept in this
            device's secure storage. Nothing is sent anywhere else.
          </Text>
          <Text style={[styles.label, { color: c.text }]}>Client ID</Text>
          <TextInput
            accessibilityLabel="Client ID"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setClientId}
            style={input}
            textContentType="none"
            value={clientId}
          />
          <Text style={[styles.label, { color: c.text }]}>Client secret</Text>
          <TextInput
            accessibilityLabel="Client secret"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setClientSecret}
            secureTextEntry
            style={input}
            textContentType="none"
            value={clientSecret}
          />
          {error && <Banner tone="danger">{error}</Banner>}
          <Button label={busy ? 'Checking…' : 'Connect'} disabled={!ready || busy} onPress={submit} />
          <Text style={[styles.or, { color: c.muted }]}>No account handy?</Text>
          <Button label="Try the demo" variant="secondary" disabled={busy} onPress={startDemo} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 17 },
  or: { textAlign: 'center', marginTop: 8 },
});
