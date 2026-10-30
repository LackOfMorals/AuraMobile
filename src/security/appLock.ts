import * as Keychain from 'react-native-keychain';
import { APP_NAME } from '../appName';
import { APPLOCK_SERVICE } from './keychainNames';

const SERVICE = APPLOCK_SERVICE;
const SENTINEL = 'unlocked';

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'no-screen-lock' | 'cancelled' | 'failed' };

const options = {
  service: SERVICE,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
};

/**
 * Creates the sentinel item the lock gate reads. It is only readable after
 * Face ID or the device passcode, and only exists while a passcode is set,
 * so a device without a screen lock cannot create it.
 */
export async function enrollLock(): Promise<boolean> {
  try {
    const stored = await Keychain.setGenericPassword('applock', SENTINEL, {
      ...options,
      accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    return stored !== false;
  } catch {
    return false;
  }
}

/** Prompts for Face ID, falling back to the device passcode. */
export async function unlock(): Promise<UnlockResult> {
  if (!(await Keychain.hasGenericPassword({ service: SERVICE }))) {
    if (!(await enrollLock())) {
      return { ok: false, reason: 'no-screen-lock' };
    }
  }
  try {
    const item = await Keychain.getGenericPassword({
      ...options,
      authenticationPrompt: { title: `Unlock ${APP_NAME}`, cancel: 'Cancel' },
    });
    return item && item.password === SENTINEL
      ? { ok: true }
      : { ok: false, reason: 'cancelled' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
