import { buildConnectionFile, connectionFileName } from '../lib/connectionFile';

export interface ExportInstance {
  auraId: string;
  name: string;
  connectionUrl: string | null;
}

export interface ExportDeps {
  /** Asks for Face ID or the passcode, then returns the stored login. Null if the person cancels or nothing is stored. */
  reveal(auraId: string): Promise<{ username: string; password: string } | null>;
  /** Writes the text to a private temporary file and opens the system "Save to Files" sheet. */
  saveText(filename: string, contents: string): Promise<{ saved: boolean; name?: string | null; error?: string | null }>;
  /** Counts the export in the audit trail. Never given the password. */
  recordExport(auraId: string): Promise<void>;
  now(): Date;
}

export type ExportOutcome =
  | { kind: 'saved'; name: string | null }
  /** The person closed the save sheet. */
  | { kind: 'cancelled' }
  /** Face ID or the passcode was cancelled, or no password is stored. Nothing was written. */
  | { kind: 'not-unlocked' }
  /** Nothing was asked for, because the instance has no address to put in the file. */
  | { kind: 'unavailable'; message: string }
  | { kind: 'failed'; message: string };

/**
 * Saves an instance's connection details to a file the person chooses the place for, for example iCloud Drive, so they can pick it up
 * on a Mac. The order is the point: nothing is read from the Keychain until the person has passed Face ID or the passcode, nothing is
 * written until it has, and the password goes straight into the file text, never into app state, the database or a message.
 */
export async function exportConnection(deps: ExportDeps, instance: ExportInstance): Promise<ExportOutcome> {
  if (!instance.connectionUrl) {
    return { kind: 'unavailable', message: 'This instance has no connection address yet, so there is nothing to save.' };
  }
  const login = await deps.reveal(instance.auraId);
  if (!login) {
    return { kind: 'not-unlocked' };
  }
  const contents = buildConnectionFile(
    { uri: instance.connectionUrl, username: login.username, password: login.password, instanceId: instance.auraId, instanceName: instance.name },
    deps.now(),
  );
  let result;
  try {
    result = await deps.saveText(connectionFileName(instance.name, instance.auraId), contents);
  } catch {
    return { kind: 'failed', message: 'The file could not be saved. Nothing was left on this iPhone.' };
  }
  if (!result.saved) {
    return result.error ? { kind: 'failed', message: 'The file could not be saved. Nothing was left on this iPhone.' } : { kind: 'cancelled' };
  }
  // A failure to count it must not hide that the file was saved
  await deps.recordExport(instance.auraId).catch(() => undefined);
  return { kind: 'saved', name: result.name ?? null };
}
