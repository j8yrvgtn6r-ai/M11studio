import {
  clearProtocolBuildEvents,
  endProtocolBuildSession,
  resetImportBuildConsoleWorkspace,
} from '../build/protocolBuildConsoleStore';
import { clearImportedAssets, clearAssets } from '../assets/protocolAssetRegistry';
import { clearReplaceTransactions } from '../search/replaceTransaction';
import { resetProtocolLintScheduler } from '../authoring/linting/protocolLintScheduler';
import { clearIntellisenseAcceptanceRecords } from '../authoring/intellisense';
import { clearProtocolEntityReferences } from '../entities/protocolEntityReference';
import { resetProtocolEntityRegistryCache } from '../entities/protocolEntityRegistry';
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
  clearReplaceTransactions();
  clearImportedAssets();
  clearIntellisenseAcceptanceRecords();
  resetProtocolLintScheduler();
  clearProtocolEntityReferences();
  resetProtocolEntityRegistryCache();
  persistImportWorkspaceReset();
  clearProtocolBuildEvents();
  resetImportBuildConsoleWorkspace();
  endProtocolBuildSession('idle');
}

/** Clears all project artifacts and returns M11 Studio to a blank workspace. */
export async function resetProject(): Promise<void> {
  resetImportWorkspace();
  clearAssets();
  clearReplaceTransactions();
  resetProtocolStoreToBlank();
  clearProtocolVersioningState(getProtocolImportState().protocolId ?? undefined);
  await clearAllProtocolImportStorage();
  persistProjectReset();
}
