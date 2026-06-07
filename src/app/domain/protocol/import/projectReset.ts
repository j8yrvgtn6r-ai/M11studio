import {
  clearProtocolBuildEvents,
  endProtocolBuildSession,
  resetImportBuildConsoleWorkspace,
} from '../build/protocolBuildConsoleStore';
import { resetProtocolStoreToBlank } from '../store/protocolStore';
import { clearProtocolVersioningState } from './protocolVersioning';
import { clearAllProtocolImportStorage } from './protocolImportStorage';
import { clearSoAKnowledge } from '../../soa-knowledge/soaKnowledgeStore';
import { clearSoAProposal } from '../../soa-knowledge/soaProposalStore';
import { clearSoAEnrichmentProposal } from '../../soa-knowledge/soaEnrichmentStore';
import { clearSoANarrativeSyncState } from '../../soa-knowledge/soaNarrativeSyncStore';
import {
  getProtocolImportState,
  persistImportWorkspaceReset,
  persistProjectReset,
} from './protocolImportStore';

/** Clears import/reconstruction workspace state before a replacement protocol import. */
export function resetImportWorkspace(): void {
  clearSoAKnowledge();
  clearSoAProposal();
  clearSoAEnrichmentProposal();
  clearSoANarrativeSyncState();
  persistImportWorkspaceReset();
  clearProtocolBuildEvents();
  resetImportBuildConsoleWorkspace();
  endProtocolBuildSession('idle');
}

/** Clears all project artifacts and returns M11 Studio to a blank workspace. */
export async function resetProject(): Promise<void> {
  resetImportWorkspace();
  resetProtocolStoreToBlank();
  clearProtocolVersioningState(getProtocolImportState().protocolId ?? undefined);
  await clearAllProtocolImportStorage();
  persistProjectReset();
}
