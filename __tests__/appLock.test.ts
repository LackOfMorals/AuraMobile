import * as Keychain from 'react-native-keychain';
import { unlock } from '../src/security/appLock';

jest.mock('react-native-keychain', () => ({
  ACCESS_CONTROL: { BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode' },
  ACCESSIBLE: { WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'AccessibleWhenPasscodeSetThisDeviceOnly' },
  hasGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(),
}));

const kc = jest.mocked(Keychain);

beforeEach(() => jest.resetAllMocks());

test('unlocks when the keychain item is returned after authentication', async () => {
  kc.hasGenericPassword.mockResolvedValue(true);
  kc.getGenericPassword.mockResolvedValue({
    username: 'applock',
    password: 'unlocked',
    service: 's',
    storage: 'keychain',
  } as never);
  expect(await unlock()).toEqual({ ok: true });
});

test('reports no screen lock when the item cannot be created', async () => {
  kc.hasGenericPassword.mockResolvedValue(false);
  kc.setGenericPassword.mockRejectedValue(new Error('no passcode'));
  expect(await unlock()).toEqual({ ok: false, reason: 'no-screen-lock' });
});

test('reports cancelled when the user declines', async () => {
  kc.hasGenericPassword.mockResolvedValue(true);
  kc.getGenericPassword.mockResolvedValue(false);
  expect(await unlock()).toEqual({ ok: false, reason: 'cancelled' });
});

test('reports failed when authentication throws', async () => {
  kc.hasGenericPassword.mockResolvedValue(true);
  kc.getGenericPassword.mockRejectedValue(new Error('lockout'));
  expect(await unlock()).toEqual({ ok: false, reason: 'failed' });
});
