import { create } from 'zustand';
import { unlock, UnlockResult } from '../security/appLock';

type LockState = {
  locked: boolean;
  busy: boolean;
  failure: Extract<UnlockResult, { ok: false }>['reason'] | null;
  lock: () => void;
  tryUnlock: () => Promise<void>;
};

export const useLockStore = create<LockState>((set, get) => ({
  locked: true,
  busy: false,
  failure: null,
  lock: () => set({ locked: true, failure: null }),
  tryUnlock: async () => {
    if (get().busy) {
      return;
    }
    set({ busy: true });
    const result = await unlock();
    set(
      result.ok
        ? { locked: false, busy: false, failure: null }
        : { busy: false, failure: result.reason },
    );
  },
}));
