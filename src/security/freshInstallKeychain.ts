import * as Keychain from 'react-native-keychain';
import { getInstallMarker, getMode, setInstallMarker } from '../storage/settings';
import type { FreshInstallDeps } from './freshInstall';

/** The real Keychain and app storage behind clearKeychainOnFreshInstall. Kept apart so the logic can be tested without a device. */
export const keychainDeps: FreshInstallDeps = {
  isMarked: () => getInstallMarker(),
  mark: () => setInstallMarker(),
  hasPriorUse: () => getMode() !== null,
  services: () => Keychain.getAllGenericPasswordServices(),
  remove: service => Keychain.resetGenericPassword({ service }),
};
