import { agentManager } from './AgentManager';
import { titlePageExtractionAgent, TITLE_PAGE_EXTRACTION_AGENT_ID } from './TitlePageExtractionAgent';
import { appendProtocolBuildEvent } from '../domain/protocol/build/protocolBuildConsoleStore';
import { hydrateTitlePageFromValues } from '../domain/protocol/authoring/titlePageMigration';
import { mutateProtocolDocument, getProtocolDocument } from '../domain/protocol/store/protocolStore';
import { selectFieldDefinitions } from '../domain/protocol/selectors/toFieldDefinitions';
import { syncTitlePageSectionStatus } from '../domain/protocol/authoring/titlePageAuthoring';
import type { ImportedProtocolSource } from '../domain/protocol/import/types';
import type { ProtocolKnowledgeModel } from '../domain/protocol/import/protocolKnowledgeTypes';
import type { TitlePageExtractionAgentOutput } from './TitlePageExtractionAgent';

let initialized = false;

function ensureTitlePageExtractionAgentRegistered(): void {
  if (initialized) {
    return;
  }
  if (!agentManager.getAgent(TITLE_PAGE_EXTRACTION_AGENT_ID)) {
    agentManager.register(titlePageExtractionAgent);
  }
  initialized = true;
}

export async function runTitlePageExtractionAgent(
  sourceExtraction: ImportedProtocolSource,
  knowledgeModel?: ProtocolKnowledgeModel,
): Promise<TitlePageExtractionAgentOutput> {
  ensureTitlePageExtractionAgentRegistered();
  appendProtocolBuildEvent({ type: 'progress', message: 'Title Page Extraction Agent started' });

  const result = await agentManager.runAgent(TITLE_PAGE_EXTRACTION_AGENT_ID, {
    trigger: 'import',
    protocolDocument: getProtocolDocument(),
    sourceExtraction: sourceExtraction,
    protocolKnowledgeModel: knowledgeModel ?? null,
    input: { sourceExtraction, knowledgeModel },
  });

  const output = result.output ?? {
    matches: [],
    extractedFieldCount: 0,
    titlePageText: '',
    notes: [],
    values: {},
  };

  if (output.extractedFieldCount > 0) {
    mutateProtocolDocument((document) => {
      hydrateTitlePageFromValues(document, output.values);
      syncTitlePageSectionStatus(document, selectFieldDefinitions(document));
    });
    appendProtocolBuildEvent({
      type: 'success',
      message: `Title page hydrated with ${output.extractedFieldCount} extracted field(s)`,
      metadata: { fieldIds: Object.keys(output.values) },
    });
  } else {
    appendProtocolBuildEvent({ type: 'info', message: 'Title page extraction found no confident matches' });
  }

  return output;
}

export function applyTitlePageExtractionToDocument(values: Record<string, unknown>): void {
  mutateProtocolDocument((document) => {
    hydrateTitlePageFromValues(document, values);
    syncTitlePageSectionStatus(document, selectFieldDefinitions(document));
  });
}
