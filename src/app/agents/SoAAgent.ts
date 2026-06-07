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
import { appendProtocolBuildEvent } from '../domain/protocol/build/protocolBuildConsoleStore';
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
  description: 'Extracts Schedule of Activities structure from narrative and DOCX schedule tables.',
  async execute(context: AgentContext<SoAAgentInput>): Promise<AgentResult<SoAAgentOutput>> {
    const startedAt = new Date().toISOString();
    const events = [
      createAgentEvent(SOA_AGENT_ID, {
        type: 'progress',
        message: 'SoA Agent v3 started',
        sectionId: context.selectedSectionId,
      }),
      createAgentEvent(SOA_AGENT_ID, {
        type: 'progress',
        message: 'Extracting visits from narrative',
        sectionId: context.selectedSectionId,
      }),
      createAgentEvent(SOA_AGENT_ID, {
        type: 'progress',
        message: 'Extracting assessments from narrative',
        sectionId: context.selectedSectionId,
      }),
    ];

    appendProtocolBuildEvent({ type: 'progress', message: 'SoA table extraction started' });

    try {
      appendProtocolBuildEvent({ type: 'progress', message: 'Reconciling narrative and table evidence' });
      const output = evaluateSoAScheduleExtraction(context.input);
      const counts = countSoAKnowledgePatch(output.soaKnowledgePatch);
      const candidateCount = output.tableExtraction?.candidateTables.length ?? 0;
      const tableVisits = output.tableExtraction?.extractedVisits.length ?? 0;
      const tableRules = output.tableExtraction?.extractedScheduleRules.length ?? 0;

      appendProtocolBuildEvent({
        type: 'info',
        message: `Found ${candidateCount} candidate schedule tables`,
      });
      appendProtocolBuildEvent({
        type: 'success',
        message: `Extracted ${tableVisits} visits from tables`,
      });
      appendProtocolBuildEvent({
        type: 'success',
        message: `Extracted ${tableRules} schedule rules from tables`,
      });
      appendProtocolBuildEvent({ type: 'progress', message: 'Created matrix proposal preview' });

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
        tableExtraction: output.tableExtraction,
        matrixPreview: output.matrixPreview,
        sourceSummary: output.sourceSummary,
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
          message: 'SoA Agent v3 completed',
        }),
      );

      appendProtocolBuildEvent({ type: 'success', message: 'SoA Agent v3 completed' });

      return createAgentResult(SOA_AGENT_ID, startedAt, {
        status: output.extractedItems.length > 0 || (output.tableExtraction?.extractedScheduleRules.length ?? 0) > 0 ? 'success' : 'partial',
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
      appendProtocolBuildEvent({ type: 'warning', message: `SoA Agent v3 failed safely: ${message}` });
      return createAgentResult(SOA_AGENT_ID, startedAt, {
        status: 'failed',
        errors: [message],
        events,
      });
    }
  },
};
