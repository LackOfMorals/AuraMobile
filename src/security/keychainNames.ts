/**
 * The Keychain item names. They are built from the bundle ID, not from the app's name, so a change of name leaves them alone: changing
 * one would orphan what is already stored. Kept apart from the Keychain code so tests can use them without a device.
 */
export const KEYCHAIN_PREFIX = 'io.github.lackofmorals.auramobile.';
export const CREDENTIALS_SERVICE = `${KEYCHAIN_PREFIX}aura-credentials`;
export const APPLOCK_SERVICE = `${KEYCHAIN_PREFIX}applock`;
export const INSTANCE_PASSWORD_PREFIX = `${KEYCHAIN_PREFIX}instance-password.`;
export const instancePasswordService = (auraId: string): string => `${INSTANCE_PASSWORD_PREFIX}${auraId}`;
