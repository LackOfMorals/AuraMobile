import { eq, sql } from 'drizzle-orm';
import * as Keychain from 'react-native-keychain';
import { db, schema } from '../db';
import type { CredentialVault } from '../services/operations/types';

const service = (auraId: string) => `io.github.lackofmorals.auramobile.instance-password.${auraId}`;

/**
 * Instance passwords, one Keychain item each. Aura shows a password once, so it is stored the moment it arrives. Reading it
 * back needs Face ID or the device passcode every time, and it never leaves this device.
 */
export const instanceVault: CredentialVault & { reveal(auraId: string): Promise<{ username: string; password: string } | null> } = {
  async save(auraId, username, password) {
    const stored = await Keychain.setGenericPassword(username, password, {
      service: service(auraId),
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    if (stored === false) {
      throw new Error('The Keychain refused the password');
    }
  },

  async link(auraId) {
    await db.update(schema.instance).set({ hasStoredPassword: true }).where(eq(schema.instance.auraId, auraId));
  },

  async delete(auraId) {
    await Keychain.resetGenericPassword({ service: service(auraId) });
    await db.update(schema.instance).set({ hasStoredPassword: false }).where(eq(schema.instance.auraId, auraId));
  },

  /** Prompts for Face ID or the passcode. Null if the person cancels or nothing is stored. */
  async reveal(auraId) {
    try {
      const item = await Keychain.getGenericPassword({
        service: service(auraId),
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        authenticationPrompt: { title: 'Show the instance password', cancel: 'Cancel' },
      });
      if (item === false) {
        return null;
      }
      await db
        .update(schema.instance)
        .set({ passwordRevealCount: sql`${schema.instance.passwordRevealCount} + 1` })
        .where(eq(schema.instance.auraId, auraId));
      return { username: item.username, password: item.password };
    } catch {
      return null;
    }
  },
};
