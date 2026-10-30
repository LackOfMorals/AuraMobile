import { CREDENTIALS_SERVICE, INSTANCE_PASSWORD_PREFIX } from './keychainNames';

/** The Keychain services that hold secrets: the Aura client secret, and one item for each stored instance password. */
export const isSecretService = (service: string): boolean => service === CREDENTIALS_SERVICE || service.startsWith(INSTANCE_PASSWORD_PREFIX);

export interface FreshInstallDeps {
  isMarked(): boolean;
  mark(): void;
  /** Whether this install has been used: connected to Aura, or tried the demo. */
  hasPriorUse(): boolean;
  services(): Promise<string[]>;
  remove(service: string): Promise<unknown>;
}

/**
 * iOS keeps Keychain items when an app is deleted, so a fresh install could find a client secret and instance passwords left by the
 * one before. On the first launch of an install that has not been used, remove them. An install that is already in use is only marked, so
 * an update never removes what the person is relying on. Nothing is marked if removal fails, so the next launch tries again.
 */
export async function clearKeychainOnFreshInstall(deps: FreshInstallDeps): Promise<'cleared' | 'marked' | 'done'> {
  if (deps.isMarked()) {
    return 'done';
  }
  if (deps.hasPriorUse()) {
    deps.mark();
    return 'marked';
  }
  for (const service of (await deps.services()).filter(isSecretService)) {
    await deps.remove(service);
  }
  deps.mark();
  return 'cleared';
}
