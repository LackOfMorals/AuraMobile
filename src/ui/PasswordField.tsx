import Clipboard from '@react-native-clipboard/clipboard';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { instanceVault } from '../security/instanceVault';
import { useColors } from '../theme/colors';
import { Button } from './index';

/** How long a revealed password stays on screen. */
export const HIDE_AFTER_MS = 30_000;

/**
 * Shows an instance's stored password only after Face ID or the passcode, then hides it again: after 30 seconds,
 * and at once if the app leaves the foreground. The password is never kept in state longer than it is shown.
 */
export function PasswordField({ auraId }: { auraId: string }) {
  const c = useColors();
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = () => {
    clearTimeout(timer.current);
    setCreds(null);
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        hide();
      }
    });
    return () => {
      sub.remove();
      clearTimeout(timer.current);
    };
  }, []);

  async function show() {
    setMessage(null);
    const found = await instanceVault.reveal(auraId);
    if (!found) {
      setMessage('The password was not shown. You may have cancelled, or none is stored.');
      return;
    }
    setCreds(found);
    clearTimeout(timer.current);
    timer.current = setTimeout(hide, HIDE_AFTER_MS);
  }

  if (!creds) {
    return (
      <View style={styles.box}>
        <Button label="Show password" variant="secondary" onPress={show} />
        {message ? <Text style={{ color: c.muted }}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={{ color: c.muted }}>Username</Text>
      <Text selectable style={[styles.value, { color: c.text }]}>{creds.username}</Text>
      <Text style={{ color: c.muted }}>Password</Text>
      <Text selectable style={[styles.value, styles.mono, { color: c.text }]}>{creds.password}</Text>
      <View style={styles.row}>
        <Button label="Copy password" variant="secondary" onPress={() => Clipboard.setString(creds.password)} />
        <Button label="Hide" variant="secondary" onPress={hide} />
      </View>
      <Text style={{ color: c.muted }}>Hides itself after 30 seconds.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6 },
  value: { fontSize: 17, fontWeight: '600' },
  mono: { fontFamily: 'Menlo' },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
});
