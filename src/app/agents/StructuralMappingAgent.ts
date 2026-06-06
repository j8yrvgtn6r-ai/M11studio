import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import { createAgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';
import {
  evaluateStructuralMapping,
  type StructuralMappingAgentInput,
  type StructuralMappingAgentOutput,
} from './structuralMappingRules';

export const STRUCTURAL_MAPPING_AGENT_ID = 'structural-mapping-agent';

export type {
  AgentMappedSection,
  StructuralMappingAgentInput,
  StructuralMappingAgentOutput,
  StructuralMappingAgentTrigger,
  SuspiciousMappingRecord,
} from './structuralMappingRules';

export const structuralMappingAgent: Agent<StructuralMappingAgentInput, StructuralMappingAgentOutput> = {
  id: STRUCTURAL_MAPPING_AGENT_ID,
  label: 'Structural Mapping Agent',
  description: 'Maps source protocol headings to M11 sections with verbatim body extraction.',
  async execute(
    context: AgentContext<StructuralMappingAgentInput>,
  ): Promise<AgentResult<StructuralMappingAgentOutput>> {
    const startedAt = new Date().toISOString();
    const events = [
      createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
        type: 'progress',
        message: 'Structural Mapping Agent started',
      }),
      createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
        type: 'progress',
        message: 'Matching protocol headings to M11',
      }),
    ];

    try {
      if (!context.input.sourceExtraction) {
        events.push(
          createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
            type: 'info',
            message: 'Structural Mapping Agent skipped — source extraction missing',
          }),
        );
        return createAgentResult(STRUCTURAL_MAPPING_AGENT_ID, startedAt, {
          status: 'skipped',
          output: {
            mappedSections: [],
            unmappedSourceSections: [],
            unmappedM11Sections: [],
            suspiciousMappings: [],
            mappingSummary: {
              importedCount: 0,
              needsGenerationCount: 0,
              suspiciousCount: 0,
              unmappedSourceCount: 0,
            },
          },
          warnings: ['Source extraction missing'],
          events,
        });
      }

      if (!context.input.m11TemplateSections?.length && context.input.trigger !== 'import') {
        // import trigger uses default template inside rules
      }

      const output = evaluateStructuralMapping(context.input, {
        onSuspiciousMapping: (record) => {
          events.push(
            createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
              type: 'warning',
              message: `Suspicious mapping skipped for ${record.mappedM11SectionId}: ${record.reason}`,
              sectionId: record.mappedM11SectionId,
            }),
          );
        },
      });

      if (output.mappingSummary.importedCount > 0) {
        events.push(
          createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
            type: 'success',
            message: `${output.mappingSummary.importedCount} sections imported from source`,
            metadata: { importedCount: output.mappingSummary.importedCount },
          }),
        );
      }

      if (output.mappingSummary.needsGenerationCount > 0) {
        events.push(
          createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
            type: 'info',
            message: `${output.mappingSummary.needsGenerationCount} sections require generation`,
            metadata: { needsGenerationCount: output.mappingSummary.needsGenerationCount },
          }),
        );
      }

      if (output.mappingSummary.suspiciousCount > 0) {
        events.push(
          createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
            type: 'warning',
            message: `${output.mappingSummary.suspiciousCount} suspicious mappings skipped`,
            metadata: { suspiciousCount: output.mappingSummary.suspiciousCount },
          }),
        );
      }

      events.push(
        createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
          type: 'success',
          message: 'Structural Mapping Agent completed',
        }),
      );

      return createAgentResult(STRUCTURAL_MAPPING_AGENT_ID, startedAt, {
        status: output.mappedSections.length > 0 ? 'success' : 'partial',
        output,
        affectedSectionIds: output.mappedSections.map((entry) => entry.mappedM11SectionId),
        events,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      events.push(
        createAgentEvent(STRUCTURAL_MAPPING_AGENT_ID, {
          type: 'error',
          message: `Structural Mapping Agent failed: ${message}`,
        }),
      );
      return createAgentResult(STRUCTURAL_MAPPING_AGENT_ID, startedAt, {
        status: 'failed',
        errors: [message],
        events,
      });
    }
  },
};
