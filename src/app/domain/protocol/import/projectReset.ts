import {
  clearProtocolBuildEvents,
  endProtocolBuildSession,
  resetImportBuildConsoleWorkspace,
} from '../build/protocolBuildConsoleStore';
import { resetProtocolStore } from '../store/protocolStore';
import { clearProtocolVersioningState } from './protocolVersioning';
import { clearAllProtocolImportStorage } from './protocolImportStorage';
import { clearSoAKnowledge } from '../../soa-knowledge/soaKnowledgeStore';
import { clearSoAProposal } from '../../soa-knowledge/soaProposalStore';
import {
  getProtocolImportState,
  persistImportWorkspaceReset,
  persistProjectReset,
} from './protocolImportStore';

/** Clears import/reconstruction workspace state before a replacement protocol import. */
export function resetImportWorkspace(): void {
  clearSoAKnowledge();
  clearSoAProposal();
  persistImportWorkspaceReset();
  clearProtocolBuildEvents();
  resetImportBuildConsoleWorkspace();
  endProtocolBuildSession('idle');
}

/** Clears all project artifacts and returns M11 Studio to a blank workspace. */
export async function resetProject(): Promise<void> {
  resetImportWorkspace();
  resetProtocolStore();
  clearProtocolVersioningState(getProtocolImportState().protocolId ?? undefined);
  await clearAllProtocolImportStorage();
  persistProjectReset();
}
