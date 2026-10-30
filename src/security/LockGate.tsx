import { ReactNode, useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { Text } from '../ui/Text';
import { useLockStore } from '../state/lockStore';

const RELOCK_AFTER_MS = 30_000;

const MESSAGES = {
  'no-screen-lock':
    'Set a device passcode in Settings to use Jax. Your Aura credentials are protected by it.',
  cancelled: 'Authentication was cancelled.',
  failed: 'Authentication failed. Try again.',
} as const;

/** Renders nothing but the lock screen until Face ID or the passcode succeeds. */
export function LockGate({ children }: { children: ReactNode }) {
  const { locked, busy, failure, lock, tryUnlock } = useLockStore();
  const dark = useColorScheme() === 'dark';
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    tryUnlock();
  }, [tryUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        const away = leftAt.current ? Date.now() - leftAt.current : 0;
        leftAt.current = null;
        if (away >= RELOCK_AFTER_MS) {
          lock();
          tryUnlock();
        }
      } else if (leftAt.current === null) {
        leftAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [lock, tryUnlock]);

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.screen, dark ? styles.dark : styles.light]}>
      <Text style={[styles.title, dark && styles.textDark]}>Jax</Text>
      {failure && (
        <Text style={[styles.message, dark && styles.textDark]}>
          {MESSAGES[failure]}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={tryUnlock}
        style={[styles.button, busy && styles.disabled]}>
        <Text style={styles.buttonText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  light: { backgroundColor: '#f4f7fa' },
  dark: { backgroundColor: '#0b1520' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f2233' },
  textDark: { color: '#eef3f8' },
  message: { textAlign: 'center', color: '#53697d' },
  button: {
    minHeight: 44,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#0a6190',
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 17 },
});
