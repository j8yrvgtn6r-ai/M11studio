import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import { createAgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';
import {
  extractTitlePageFields,
  titlePageExtractionToValues,
  type TitlePageExtractionOutput,
} from '../domain/protocol/authoring/titlePageExtractionRules';
import type { ImportedProtocolSource } from '../domain/protocol/import/types';
import type { ProtocolKnowledgeModel } from '../domain/protocol/import/protocolKnowledgeTypes';

export const TITLE_PAGE_EXTRACTION_AGENT_ID = 'title-page-extraction-agent';

export interface TitlePageExtractionAgentInput {
  sourceExtraction: ImportedProtocolSource;
  knowledgeModel?: ProtocolKnowledgeModel;
}

export interface TitlePageExtractionAgentOutput extends TitlePageExtractionOutput {
  values: Record<string, unknown>;
}

export const titlePageExtractionAgent: Agent<
  TitlePageExtractionAgentInput,
  TitlePageExtractionAgentOutput
> = {
  id: TITLE_PAGE_EXTRACTION_AGENT_ID,
  label: 'Title Page Extraction Agent',
  description: 'Extracts M11 title page fields from DOCX tables, headers, and title-page text before narrative reconstruction.',
  async execute(
    context: AgentContext<TitlePageExtractionAgentInput>,
  ): Promise<AgentResult<TitlePageExtractionAgentOutput>> {
    const startedAt = new Date().toISOString();
    const events = [
      createAgentEvent(TITLE_PAGE_EXTRACTION_AGENT_ID, {
        type: 'progress',
        message: 'Title Page Extraction Agent started',
      }),
    ];

    if (!context.input.sourceExtraction) {
      return createAgentResult(TITLE_PAGE_EXTRACTION_AGENT_ID, startedAt, {
        status: 'skipped',
        output: {
          matches: [],
          extractedFieldCount: 0,
          titlePageText: '',
          notes: ['Source extraction missing'],
          values: {},
        },
        warnings: ['Source extraction missing'],
        events,
      });
    }

    const output = extractTitlePageFields(context.input.sourceExtraction, context.input.knowledgeModel);
    const values = titlePageExtractionToValues(output);

    events.push(
      createAgentEvent(TITLE_PAGE_EXTRACTION_AGENT_ID, {
        type: output.extractedFieldCount > 0 ? 'success' : 'info',
        message:
          output.extractedFieldCount > 0
            ? `Extracted ${output.extractedFieldCount} title page field(s)`
            : 'No title page fields extracted',
        metadata: { extractedFieldCount: output.extractedFieldCount },
      }),
    );

    return createAgentResult(TITLE_PAGE_EXTRACTION_AGENT_ID, startedAt, {
      status: 'success',
      output: { ...output, values },
      events,
    });
  },
};
