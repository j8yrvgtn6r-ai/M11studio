import { isScheduleCacheStale, regenerateScheduleCacheInDocument } from '../scheduleGeneration/scheduleCache';
import { getProtocolDocument, mutateProtocolDocument } from './protocolStore';

/** Regenerates document.schedule inside an open store mutation (single notify). */
export function regenerateScheduleCacheAfterMutation(document: ProtocolDocument): void {
  regenerateScheduleCacheInDocument(document);
}

/** Regenerates document.schedule from current generation sources and refreshes cache metadata. */
export function regenerateScheduleCache(): boolean {
  mutateProtocolDocument((draft) => {
    regenerateScheduleCacheAfterMutation(draft);
  });

  return true;
}

/** Returns whether the authoritative store schedule cache is stale. */
export function isAuthoritativeScheduleCacheStale(): boolean {
  return isScheduleCacheStale(getProtocolDocument());
}
