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

export type Mode = 'demo' | 'live';

/** Which data source the app uses. Absent until the person connects or tries the demo. */
export function getMode(): Mode | null {
  const value = store.getString('mode');
  return value === 'demo' || value === 'live' ? value : null;
}

export function setMode(mode: Mode | null): void {
  if (mode === null) {
    store.remove('mode');
  } else {
    store.set('mode', mode);
  }
}

/** Live accounts start read-only: changes must be switched on deliberately. Demo mode ignores this. */
export function getAllowChanges(): boolean {
  return store.getBoolean('allowChanges') ?? false;
}

export function setAllowChanges(allow: boolean): void {
  store.set('allowChanges', allow);
}

/**
 * Set once an install has started up. App storage goes when the app is deleted but the Keychain does not, so a missing marker
 * means a fresh install (see security/freshInstall.ts).
 */
export function getInstallMarker(): boolean {
  return store.getBoolean('installed') ?? false;
}

export function setInstallMarker(): void {
  store.set('installed', true);
}
