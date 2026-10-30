import * as Keychain from 'react-native-keychain';
import type { AuraCredentials } from '../aura/types';

const SERVICE = 'io.github.lackofmorals.jax.aura-credentials';

// Readable while the device is unlocked, without a prompt per read: the client needs the
// secret for every token refresh, and the app lock already guards getting this far.
// This-device-only keeps it out of backups and iCloud Keychain.
const options = {
  service: SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function saveCredentials(c: AuraCredentials): Promise<void> {
  const stored = await Keychain.setGenericPassword(c.clientId, c.clientSecret, options);
  if (stored === false) {
    throw new Error('Could not store the credentials securely');
  }
}

export async function loadCredentials(): Promise<AuraCredentials> {
  const item = await Keychain.getGenericPassword({ service: SERVICE });
  if (item === false) {
    throw new Error('No Aura credentials are stored');
  }
  return { clientId: item.username, clientSecret: item.password };
}

export async function hasCredentials(): Promise<boolean> {
  return Keychain.hasGenericPassword({ service: SERVICE });
}

export async function clearCredentials(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
