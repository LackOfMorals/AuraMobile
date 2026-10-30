import { eq } from 'drizzle-orm';
import { create } from 'zustand';
import { AuraAuthError, AuraClient, AuraUnreachableError } from '../aura/client';
import { USER_AGENT } from '../aura/userAgent';
import { MockAura } from '../aura/mock';
import type { AuraApi, AuraCredentials } from '../aura/types';
import { db, schema } from '../db';
import { createOperationStore } from '../db/operationRepository';
import { createSyncStore } from '../db/syncRepository';
import { maskClientId } from '../lib/account';
import { clearCredentials, hasCredentials, loadCredentials, saveCredentials } from '../security/credentials';
import { clearKeychainOnFreshInstall } from '../security/freshInstall';
import { keychainDeps } from '../security/freshInstallKeychain';
import { fileExport } from '../native/fileExport';
import { instanceVault } from '../security/instanceVault';
import { OperationService } from '../services/operations/service';
import { refreshInstance } from '../services/refreshInstance';
import { runSync, SyncResult } from '../services/sync';
import { getAllowChanges, getMode, Mode, setAllowChanges, setMode } from '../storage/settings';

const ACCOUNT_ID = 'default';
const BASE_URL = 'https://api.neo4j.io';

let aura: AuraApi | undefined;

/** The data source for the current mode: the real client, or the in-memory demo. */
export function getAura(mode: Mode): AuraApi {
  aura ??= mode === 'demo' ? new MockAura() : new AuraClient({ baseUrl: BASE_URL, credentials: loadCredentials, userAgent: USER_AGENT });
  return aura;
}

let operationService: OperationService | undefined;

/** Plans, confirms and runs changes to instances. Built on first use, for whichever mode is current. */
export function operations(): OperationService {
  operationService ??= new OperationService({
    store: createOperationStore(db),
    vault: instanceVault,
    client: () => getAura(useSession.getState().mode ?? 'demo'),
    isConnected: async () => useSession.getState().mode !== null,
    onFinished: () => useSession.getState().bump(),
    onProgress: () => useSession.getState().bump(),
  });
  return operationService;
}

async function writeAccount(label: string, clientIdHint: string | null) {
  const now = new Date().toISOString();
  await db
    .insert(schema.account)
    .values({ id: ACCOUNT_ID, label, clientIdHint, status: 'CONNECTED', connectedAt: now })
    .onConflictDoUpdate({
      target: schema.account.id,
      set: { label, clientIdHint, status: 'CONNECTED', connectedAt: now, lastSyncAt: null },
    });
}

/** What we tell the person when connecting fails. Never includes the credentials. */
export function describeConnectError(err: unknown): string {
  if (err instanceof AuraAuthError) {
    return 'Aura rejected that client id and secret. Check them in the Aura console.';
  }
  if (err instanceof AuraUnreachableError) {
    return 'Could not reach Aura. Check your connection and try again.';
  }
  return 'Could not connect to Aura.';
}

type SessionState = {
  /** False until the stored mode and account have been read. */
  ready: boolean;
  mode: Mode | null;
  /** Whether a sync has finished at least once, so there is something to show. */
  synced: boolean;
  syncing: boolean;
  lastResult: SyncResult | null;
  /** Goes up whenever stored data changed outside a sync (an operation finished), so screens read it again. */
  dataVersion: number;
  /** Whether the person has switched changes on for a live account. Demo mode is always allowed. */
  allowChanges: boolean;
  bump: () => void;
  setAllowChanges: (allow: boolean) => void;
  init: () => Promise<void>;
  connect: (credentials: AuraCredentials) => Promise<string | null>;
  startDemo: () => Promise<void>;
  syncNow: () => Promise<SyncResult | null>;
  /** Reads one instance from Aura. Returns what to tell the person on failure, or null. */
  refreshOne: (auraId: string) => Promise<string | null>;
  disconnect: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  mode: null,
  synced: false,
  syncing: false,
  lastResult: null,
  dataVersion: 0,
  allowChanges: getAllowChanges(),

  bump: () => set(s => ({ dataVersion: s.dataVersion + 1 })),

  setAllowChanges: allow => {
    setAllowChanges(allow);
    set({ allowChanges: allow });
  },

  init: async () => {
    // Before anything reads the Keychain: remove secrets an earlier install left behind. A failure must never stop the app opening.
    await clearKeychainOnFreshInstall(keychainDeps).catch(() => undefined);
    // Removes a Save to Files temporary folder an earlier run left behind
    fileExport.sweep().catch(() => undefined);
    let mode = getMode();
    if (mode === 'live' && !(await hasCredentials())) {
      mode = null;
    }
    const rows = await db.select().from(schema.account);
    set({ ready: true, mode, synced: mode !== null && Boolean(rows[0]?.lastSyncAt) });
    if (mode !== null) {
      // Picks up changes a restart interrupted, without ever sending one twice
      await operations().recover().catch(() => undefined);
      get().bump();
    }
  },

  /** Returns an error message, or null once the credentials are checked and stored. */
  connect: async credentials => {
    try {
      await new AuraClient({ baseUrl: BASE_URL, credentials: async () => credentials, userAgent: USER_AGENT }).checkCredentials();
      await saveCredentials(credentials);
      await writeAccount('Aura account', maskClientId(credentials.clientId));
      aura = undefined;
      operationService = undefined;
      setMode('live');
      set({ mode: 'live', synced: false, lastResult: null });
      return null;
    } catch (err) {
      return describeConnectError(err);
    }
  },

  startDemo: async () => {
    await writeAccount('Demo account', null);
    aura = undefined;
    operationService = undefined;
    setMode('demo');
    set({ mode: 'demo', synced: false, lastResult: null });
  },

  syncNow: async () => {
    const { mode, syncing } = get();
    if (mode === null || syncing) {
      return null;
    }
    set({ syncing: true });
    try {
      const result = await runSync({ aura: getAura(mode), store: createSyncStore(db, ACCOUNT_ID) });
      set({ lastResult: result, synced: get().synced || result.status !== 'FAILED' });
      return result;
    } finally {
      set({ syncing: false });
    }
  },

  refreshOne: async auraId => {
    const { mode } = get();
    if (mode === null) {
      return null;
    }
    const failure = await refreshInstance({ aura: getAura(mode), store: createOperationStore(db) }, auraId);
    get().bump();
    return failure;
  },

  /** Forgets the credentials and clears everything stored on the device. */
  disconnect: async () => {
    await clearCredentials();
    // Passwords Aura showed once live only in the Keychain, so they go too
    for (const row of await db.select().from(schema.instance).where(eq(schema.instance.hasStoredPassword, true))) {
      await instanceVault.delete(row.auraId);
    }
    for (const table of [
      schema.operationStep,
      schema.operation,
      schema.syncRun,
      schema.instance,
      schema.instanceConfiguration,
      schema.tenant,
      schema.account,
    ]) {
      await db.delete(table);
    }
    aura = undefined;
    operationService = undefined;
    setAllowChanges(false);
    setMode(null);
    set({ mode: null, synced: false, lastResult: null, allowChanges: false });
  },
}));

/** Live accounts are read-only until switched on; the demo is always writable. */
export const useChangesAllowed = (): boolean => useSession(s => s.mode === 'demo' || (s.mode === 'live' && s.allowChanges));
