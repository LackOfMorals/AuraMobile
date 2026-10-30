import { AuraApiError } from '../aura/client';
import type { AuraApi } from '../aura/types';
import type { OperationStore } from './operations/types';
import { describeFailure } from './sync';

/**
 * Reads one instance from Aura and brings its stored copy up to date, without a full sync.
 * If Aura says it no longer exists, the stored copy is kept and marked as gone, as a sync would.
 * Returns what to tell the person on failure, or null on success. The message holds no secret.
 */
export async function refreshInstance(
  deps: { aura: AuraApi; store: Pick<OperationStore, 'refreshInstance' | 'markInstanceDeleted'>; now?: () => Date },
  auraId: string,
): Promise<string | null> {
  const at = (deps.now ?? (() => new Date()))().toISOString();
  try {
    await deps.store.refreshInstance(await deps.aura.getInstance(auraId), at);
    return null;
  } catch (err) {
    if (err instanceof AuraApiError && err.status === 404) {
      await deps.store.markInstanceDeleted(auraId, at);
      return null;
    }
    return describeFailure(err);
  }
}
