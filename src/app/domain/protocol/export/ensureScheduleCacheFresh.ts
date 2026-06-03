import { isScheduleCacheStale } from '../scheduleGeneration/scheduleCache';
import { regenerateScheduleCacheAfterMutation } from '../store/scheduleCacheMutations';
import { getProtocolDocument, mutateProtocolDocument } from '../store/protocolStore';
import type { ProtocolDocument } from '../types';

/** Regenerates document.schedule when cache metadata is missing or stale. */
export function ensureScheduleCacheFresh(document: ProtocolDocument = getProtocolDocument()): boolean {
  if (!isScheduleCacheStale(document)) {
    return false;
  }

  mutateProtocolDocument((draft) => {
    regenerateScheduleCacheAfterMutation(draft);
  });

  return true;
}

/** Ensures the authoritative store schedule cache is fresh before export. */
export function ensureAuthoritativeScheduleCacheFresh(): boolean {
  return ensureScheduleCacheFresh(getProtocolDocument());
}
