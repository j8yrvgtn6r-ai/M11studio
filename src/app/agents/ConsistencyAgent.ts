import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import { createAgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';
import type { KnowledgeExtractedItem } from './knowledgeAgentHeuristics';
import type { StudyModelPatch } from '../domain/study-model/studyModelPatch';
import type { StudyModel } from '../domain/study-model/studyModelTypes';
import { evaluateConsistencyImpacts } from './consistencyRules';

export const CONSISTENCY_AGENT_ID = 'consistency-agent';

export type ConsistencyAgentTrigger =
  | 'import'
  | 'sectionEdit'
  | 'sectionValidation'
  | 'sectionReviewed'
  | 'regeneration'
  | 'manual';

export interface ConsistencyAgentInput {
  sourceSectionId: string;
  sourceSectionTitle?: string;
  changedItems: KnowledgeExtractedItem[];
  studyModelPatch?: StudyModelPatch;
  currentStudyModel?: StudyModel | null;
  trigger: ConsistencyAgentTrigger;
  availableSectionIds: string[];
}

export interface ConsistencyAgentOutput {
  affectedSectionIds: string[];
  outOfSyncSectionIds: string[];
  reasons: string[];
  suggestedActions: string[];
  sectionImpacts: Array<{
    sectionId: string;
    reasons: Array<{
      changedItemName: string;
      changedItemCollection: string;
      relationship: string;
      reason: string;
      suggestedAction: string;
    }>;
  }>;
}

export const consistencyAgent: Agent<ConsistencyAgentInput, ConsistencyAgentOutput> = {
  id: CONSISTENCY_AGENT_ID,
  label: 'Consistency Agent',
  description: 'Marks downstream M11 sections out of sync when related study facts change.',
  async execute(context: AgentContext<ConsistencyAgentInput>): Promise<AgentResult<ConsistencyAgentOutput>> {
    const startedAt = new Date().toISOString();
    const { input } = context;
    const events = [
      createAgentEvent(CONSISTENCY_AGENT_ID, {
        type: 'progress',
        message: 'Consistency Agent started',
        sectionId: input.sourceSectionId,
      }),
      createAgentEvent(CONSISTENCY_AGENT_ID, {
        type: 'progress',
        message: 'Evaluating downstream impact',
        sectionId: input.sourceSectionId,
      }),
    ];

    try {
      if (!input.changedItems?.length) {
        events.push(
          createAgentEvent(CONSISTENCY_AGENT_ID, {
            type: 'info',
            message: 'Consistency Agent skipped — no changed study facts',
            sectionId: input.sourceSectionId,
          }),
        );
        return createAgentResult(CONSISTENCY_AGENT_ID, startedAt, {
          status: 'skipped',
          output: {
            affectedSectionIds: [],
            outOfSyncSectionIds: [],
            reasons: [],
            suggestedActions: [],
            sectionImpacts: [],
          },
          warnings: ['No changedItems provided'],
          events,
        });
      }

      if (!input.currentStudyModel) {
        events.push(
          createAgentEvent(CONSISTENCY_AGENT_ID, {
            type: 'info',
            message: 'Consistency Agent skipped — study model unavailable',
            sectionId: input.sourceSectionId,
          }),
        );
        return createAgentResult(CONSISTENCY_AGENT_ID, startedAt, {
          status: 'skipped',
          output: {
            affectedSectionIds: [],
            outOfSyncSectionIds: [],
            reasons: [],
            suggestedActions: [],
            sectionImpacts: [],
          },
          warnings: ['Study model missing'],
          events,
        });
      }

      const sectionImpacts = evaluateConsistencyImpacts({
        sourceSectionId: input.sourceSectionId,
        changedItems: input.changedItems,
        availableSectionIds: input.availableSectionIds,
      });

      const affectedSectionIds = sectionImpacts.map((impact) => impact.sectionId);
      const reasons = sectionImpacts.flatMap((impact) => impact.reasons.map((reason) => reason.reason));
      const suggestedActions = [
        ...new Set(sectionImpacts.flatMap((impact) => impact.reasons.map((reason) => reason.suggestedAction))),
      ];

      if (affectedSectionIds.length === 0) {
        events.push(
          createAgentEvent(CONSISTENCY_AGENT_ID, {
            type: 'info',
            message: 'No downstream impacts found',
            sectionId: input.sourceSectionId,
          }),
        );
        return createAgentResult(CONSISTENCY_AGENT_ID, startedAt, {
          status: 'skipped',
          output: {
            affectedSectionIds: [],
            outOfSyncSectionIds: [],
            reasons: [],
            suggestedActions: [],
            sectionImpacts: [],
          },
          events,
        });
      }

      events.push(
        createAgentEvent(CONSISTENCY_AGENT_ID, {
          type: 'warning',
          message: `${affectedSectionIds.length} downstream section(s) may be affected`,
          sectionId: input.sourceSectionId,
          metadata: { affectedCount: affectedSectionIds.length },
        }),
      );

      return createAgentResult(CONSISTENCY_AGENT_ID, startedAt, {
        status: 'success',
        output: {
          affectedSectionIds,
          outOfSyncSectionIds: affectedSectionIds,
          reasons,
          suggestedActions,
          sectionImpacts,
        },
        affectedSectionIds,
        events,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      events.push(
        createAgentEvent(CONSISTENCY_AGENT_ID, {
          type: 'error',
          message: `Consistency Agent failed: ${message}`,
          sectionId: input.sourceSectionId,
        }),
      );
      return createAgentResult(CONSISTENCY_AGENT_ID, startedAt, {
        status: 'failed',
        errors: [message],
        events,
      });
    }
  },
};
