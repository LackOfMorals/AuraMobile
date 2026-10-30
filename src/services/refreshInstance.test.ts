import { AuraApiError, AuraAuthError, AuraUnreachableError } from '../aura/client';
import { MockAura } from '../aura/mock';
import { MemoryOperationStore, storedInstance } from './operations/testing';
import { refreshInstance } from './refreshInstance';

const now = () => new Date('2026-10-30T12:00:00Z');

describe('refreshInstance', () => {
  it('brings the stored copy up to date from what Aura reports', async () => {
    const aura = new MockAura();
    await aura.updateInstance('d0000001', { name: 'renamed-in-aura' });
    const store = new MemoryOperationStore([storedInstance()]);
    expect(await refreshInstance({ aura, store, now }, 'd0000001')).toBeNull();
    expect(store.instances.get('d0000001')).toMatchObject({ name: 'renamed-in-aura', syncedAt: '2026-10-30T12:00:00.000Z', deletedInAuraAt: null });
  });

  it('marks the instance gone, and keeps it, when Aura no longer has it', async () => {
    const aura = new MockAura();
    aura.getInstance = async () => {
      throw new AuraApiError(404, [{ message: 'gone' }]);
    };
    const store = new MemoryOperationStore([storedInstance()]);
    expect(await refreshInstance({ aura, store, now }, 'd0000001')).toBeNull();
    expect(store.instances.get('d0000001')!.deletedInAuraAt).toBe('2026-10-30T12:00:00.000Z');
  });

  it.each([
    ['rejected credentials', new AuraAuthError(), /rejected the stored client id/],
    ['no connection', new AuraUnreachableError(), /Could not reach Aura/],
    ['an unknown error carrying a secret', new Error('Authorization: Basic abc123'), /unexpected error/],
  ])('says what went wrong for %s, without leaking detail, and changes nothing', async (_name, error, message) => {
    const aura = new MockAura();
    aura.getInstance = async () => {
      throw error;
    };
    const store = new MemoryOperationStore([storedInstance()]);
    const result = await refreshInstance({ aura, store, now }, 'd0000001');
    expect(result).toMatch(message);
    expect(result).not.toContain('abc123');
    expect(store.instances.get('d0000001')).toMatchObject({ name: 'orders-prod', deletedInAuraAt: null });
  });
});
