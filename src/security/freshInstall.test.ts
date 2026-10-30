import { clearKeychainOnFreshInstall, isSecretService, type FreshInstallDeps } from "./freshInstall";
import { APPLOCK_SERVICE, CREDENTIALS_SERVICE, INSTANCE_PASSWORD_PREFIX, instancePasswordService } from "./keychainNames";

const SECRET = CREDENTIALS_SERVICE;
const PASSWORD = instancePasswordService("d0000001");
const LOCK = APPLOCK_SERVICE;
const OTHER_APP = "com.example.other.aura-credentials";

function setup(over: { marked?: boolean; priorUse?: boolean; services?: string[]; failOn?: string } = {}) {
  const state = { marked: over.marked ?? false, removed: [] as string[], services: over.services ?? [SECRET, PASSWORD, LOCK, OTHER_APP] };
  const deps: FreshInstallDeps = {
    isMarked: () => state.marked,
    mark: () => { state.marked = true; },
    hasPriorUse: () => over.priorUse ?? false,
    services: async () => state.services,
    remove: async (s) => {
      if (s === over.failOn) throw new Error("keychain failed");
      state.removed.push(s);
    },
  };
  return { state, deps };
}

describe("isSecretService", () => {
  it("is the client secret and each instance password, and nothing else", () => {
    expect(isSecretService(SECRET)).toBe(true);
    expect(isSecretService(PASSWORD)).toBe(true);
    expect(isSecretService(LOCK)).toBe(false);
    expect(isSecretService(OTHER_APP)).toBe(false);
    expect(isSecretService(INSTANCE_PASSWORD_PREFIX.slice(0, -1))).toBe(false);
  });
});

describe("clearKeychainOnFreshInstall", () => {
  it("on a fresh install, removes the secrets an earlier install left, and only those, then marks", async () => {
    const { state, deps } = setup();
    expect(await clearKeychainOnFreshInstall(deps)).toBe("cleared");
    expect(state.removed.sort()).toEqual([PASSWORD, SECRET].sort());
    expect(state.marked).toBe(true);
  });

  it("never removes anything from an install that is already in use (an update), but marks it", async () => {
    const { state, deps } = setup({ priorUse: true });
    expect(await clearKeychainOnFreshInstall(deps)).toBe("marked");
    expect(state.removed).toEqual([]);
    expect(state.marked).toBe(true);
  });

  it("does nothing once marked, so later launches never touch the Keychain", async () => {
    const { state, deps } = setup({ marked: true });
    expect(await clearKeychainOnFreshInstall(deps)).toBe("done");
    expect(state.removed).toEqual([]);
  });

  it("marks a fresh install that has nothing to remove", async () => {
    const { state, deps } = setup({ services: [LOCK] });
    expect(await clearKeychainOnFreshInstall(deps)).toBe("cleared");
    expect(state.removed).toEqual([]);
    expect(state.marked).toBe(true);
  });

  it("does not mark if a removal fails, so the next launch tries again", async () => {
    const { state, deps } = setup({ failOn: PASSWORD });
    await expect(clearKeychainOnFreshInstall(deps)).rejects.toThrow("keychain failed");
    expect(state.marked).toBe(false);
  });
});
