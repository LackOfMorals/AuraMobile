import { createMMKV } from 'react-native-mmkv';

// Preferences only. Secrets belong in the Keychain and records in SQLite.
const store = createMMKV({ id: 'settings' });

export type ThemePreference = 'auto' | 'light' | 'dark';

const THEMES: readonly ThemePreference[] = ['auto', 'light', 'dark'];

export function getThemePreference(): ThemePreference {
  const value = store.getString('theme');
  return THEMES.find(t => t === value) ?? 'auto';
}

export function setThemePreference(theme: ThemePreference): void {
  store.set('theme', theme);
}
