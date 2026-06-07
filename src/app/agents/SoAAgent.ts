import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import { createAgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';
import {
  countSoAKnowledgePatch,
  evaluateSoAScheduleExtraction,
  type SoAAgentInput,
  type SoAAgentOutput,
} from './soaAgentRules';
import { createSoAProposal } from '../domain/soa-knowledge/soaProposalStore';

export const SOA_AGENT_ID = 'soa-agent';

export type {
  SoAAgentInput,
  SoAAgentOutput,
  SoAAgentTrigger,
  SoAExtractedItem,
} from './soaAgentRules';

export const soaAgent: Agent<SoAAgentInput, SoAAgentOutput> = {
  id: SOA_AGENT_ID,
  label: 'SoA Agent',
  description: 'Extracts first-pass Schedule of Activities structure from protocol narrative and SoA knowledge.',
  async execute(context: AgentContext<SoAAgentInput>): Promise<AgentResult<SoAAgentOutput>> {
    const startedAt = new Date().toISOString();
    const events = [
      createAgentEvent(SOA_AGENT_ID, {
        type: 'progress',
        message: 'SoA Agent started',
        sectionId: context.selectedSectionId,
      }),
      createAgentEvent(SOA_AGENT_ID, {
        type: 'progress',
        message: 'Extracting visits',
        sectionId: context.selectedSectionId,
      }),
      createAgentEvent(SOA_AGENT_ID, {
        type: 'progress',
        message: 'Extracting assessments',
        sectionId: context.selectedSectionId,
      }),
      createAgentEvent(SOA_AGENT_ID, {
        type: 'progress',
        message: 'Extracting schedule rules',
        sectionId: context.selectedSectionId,
      }),
    ];

    try {
      const output = evaluateSoAScheduleExtraction(context.input);
      const counts = countSoAKnowledgePatch(output.soaKnowledgePatch);

      createSoAProposal({
        trigger: context.input.trigger,
        summary: output.summary,
        soaKnowledgePatch: output.soaKnowledgePatch,
        configurationPatch: output.proposedConfigurationPatch,
        impactedNarrativeSections: output.impactedNarrativeSections,
        diagnostics: output.diagnostics,
        warnings: output.warnings,
        sourceSectionIds: output.soaKnowledgePatch.sourceSectionIds ?? [],
        counts,
      });

      events.push(
        createAgentEvent(SOA_AGENT_ID, {
          type: 'success',
          message: 'SoA proposal created',
          metadata: counts,
        }),
        createAgentEvent(SOA_AGENT_ID, {
          type: 'success',
          message: `${counts.visits} visits, ${counts.assessments} assessments, ${counts.scheduleRules} schedule rules proposed`,
          metadata: counts,
        }),
        createAgentEvent(SOA_AGENT_ID, {
          type: 'success',
          message: 'SoA Agent completed',
        }),
      );

      return createAgentResult(SOA_AGENT_ID, startedAt, {
        status: output.extractedItems.length > 0 ? 'success' : 'partial',
        output,
        warnings: output.warnings,
        events,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      events.push(
        createAgentEvent(SOA_AGENT_ID, {
          type: 'error',
          message: `SoA Agent failed: ${message}`,
        }),
      );
      return createAgentResult(SOA_AGENT_ID, startedAt, {
        status: 'failed',
        errors: [message],
        events,
      });
    }
  },
};
