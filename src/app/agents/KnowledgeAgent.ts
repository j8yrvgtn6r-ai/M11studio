import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import { createAgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';
import {
  extractKnowledgeFromSectionText,
  type KnowledgeAgentInput,
  type KnowledgeAgentOutput,
} from './knowledgeAgentHeuristics';

export const KNOWLEDGE_AGENT_ID = 'knowledge-agent-v1';

export const knowledgeAgent: Agent<KnowledgeAgentInput, KnowledgeAgentOutput> = {
  id: KNOWLEDGE_AGENT_ID,
  label: 'Knowledge Agent',
  description: 'Updates the Structured Study Model when protocol section text changes.',
  async execute(context: AgentContext<KnowledgeAgentInput>): Promise<AgentResult<KnowledgeAgentOutput>> {
    const startedAt = new Date().toISOString();
    const events = [
      createAgentEvent(KNOWLEDGE_AGENT_ID, {
        type: 'progress',
        message: 'Knowledge Agent started',
        sectionId: context.input.sectionId,
      }),
    ];

    try {
      const text = context.input.currentText.trim();
      if (!text) {
        events.push(
          createAgentEvent(KNOWLEDGE_AGENT_ID, {
            type: 'info',
            message: 'Knowledge Agent skipped empty section text',
            sectionId: context.input.sectionId,
          }),
        );
        return createAgentResult(KNOWLEDGE_AGENT_ID, startedAt, {
          status: 'skipped',
          output: {
            extractedItems: [],
            changedItems: [],
            affectedSectionIds: [],
            studyModelPatch: {},
            knowledgeEntities: [],
            knowledgeRelationships: [],
            notes: ['Empty section text'],
          },
          warnings: ['Empty section text'],
          events,
        });
      }

      const output = extractKnowledgeFromSectionText(context.input);
      if (output.extractedItems.length === 0) {
        events.push(
          createAgentEvent(KNOWLEDGE_AGENT_ID, {
            type: 'info',
            message: 'Knowledge Agent found no structured facts to extract',
            sectionId: context.input.sectionId,
          }),
        );
        return createAgentResult(KNOWLEDGE_AGENT_ID, startedAt, {
          status: 'skipped',
          output,
          warnings: output.notes,
          events,
        });
      }

      const objectiveCount = output.extractedItems.filter((item) => item.collection === 'objectives').length;
      if (objectiveCount > 0) {
        events.push(
          createAgentEvent(KNOWLEDGE_AGENT_ID, {
            type: 'success',
            message: `Knowledge Agent extracted objectives (${objectiveCount})`,
            sectionId: context.input.sectionId,
          }),
        );
      }

      const populationCount = output.extractedItems.filter((item) => item.collection === 'population').length;
      if (populationCount > 0) {
        events.push(
          createAgentEvent(KNOWLEDGE_AGENT_ID, {
            type: 'success',
            message: 'Knowledge Agent updated population',
            sectionId: context.input.sectionId,
          }),
        );
      }

      if (output.affectedSectionIds.length > 0) {
        events.push(
          createAgentEvent(KNOWLEDGE_AGENT_ID, {
            type: 'info',
            message: 'Knowledge Agent found affected sections',
            sectionId: context.input.sectionId,
            metadata: { affectedSections: output.affectedSectionIds.length },
          }),
        );
      }

      if (output.changedItems.length > 0) {
        events.push(
          createAgentEvent(KNOWLEDGE_AGENT_ID, {
            type: 'info',
            message: `Knowledge Agent updated ${output.changedItems.length} structured item(s)`,
            sectionId: context.input.sectionId,
          }),
        );
      }

      if (output.knowledgeEntities.length > 0 || output.knowledgeRelationships.length > 0) {
        events.push(
          createAgentEvent(KNOWLEDGE_AGENT_ID, {
            type: 'progress',
            message: 'Knowledge Graph update started',
            sectionId: context.input.sectionId,
          }),
        );
        events.push(
          createAgentEvent(KNOWLEDGE_AGENT_ID, {
            type: 'success',
            message: `Knowledge Graph updated (${output.knowledgeEntities.length} entities, ${output.knowledgeRelationships.length} relationships)`,
            sectionId: context.input.sectionId,
            metadata: {
              entityCount: output.knowledgeEntities.length,
              relationshipCount: output.knowledgeRelationships.length,
            },
          }),
        );
      }

      events.push(
        createAgentEvent(KNOWLEDGE_AGENT_ID, {
          type: 'success',
          message: 'Knowledge Agent completed',
          sectionId: context.input.sectionId,
        }),
      );

      return createAgentResult(KNOWLEDGE_AGENT_ID, startedAt, {
        status: output.changedItems.length > 0 ? 'success' : 'partial',
        output,
        affectedSectionIds: output.affectedSectionIds,
        studyModelUpdates: output.studyModelPatch,
        warnings: output.notes,
        events,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      events.push(
        createAgentEvent(KNOWLEDGE_AGENT_ID, {
          type: 'error',
          message: `Knowledge Agent failed: ${message}`,
          sectionId: context.input.sectionId,
        }),
      );
      return createAgentResult(KNOWLEDGE_AGENT_ID, startedAt, {
        status: 'failed',
        errors: [message],
        events,
      });
    }
  },
};
