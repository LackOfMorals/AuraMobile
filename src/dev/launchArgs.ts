import { Settings } from 'react-native';

/**
 * Launch switches for taking screenshots in the simulator: `xcrun simctl launch <device> <bundle id> -DevDemo 1 -DevScreen Home`.
 * They work only in development builds. In a Release build `__DEV__` is false, so this always answers undefined and the switches
 * do nothing: there is no way to skip the lock in a build that goes to the App Store.
 */
export function devArg(name: 'DevSkipLock' | 'DevDemo' | 'DevScreen'): string | undefined {
  if (!__DEV__) {
    return undefined;
  }
  const value = Settings.get(name);
  return typeof value === 'string' && value !== '' ? value : undefined;
}
