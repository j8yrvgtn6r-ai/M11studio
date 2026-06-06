import { agentManager } from './AgentManager';
import { KNOWLEDGE_AGENT_ID, knowledgeAgent } from './KnowledgeAgent';
import { CONSISTENCY_AGENT_ID, consistencyAgent } from './ConsistencyAgent';
import { structuralMappingAgent } from './StructuralMappingAgent';
import {
  evaluateStructuralMapping,
  toStructuralMappingResult,
  type StructuralMappingAgentOutput,
  type StructuralMappingAgentTrigger,
  type StructuralMappingRuleOptions,
} from './structuralMappingRules';
import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../domain/protocol/ichM11/ichM11Template';
import { appendProtocolBuildEvent } from '../domain/protocol/build/protocolBuildConsoleStore';
import type { ImportedProtocolSource, StructuralMappingResult } from '../domain/protocol/import/types';

let initialized = false;

const AGGREGATE_BATCH_SIZE = 10;

function ensureAgentsRegistered(): void {
  if (initialized) {
    return;
  }
  if (!agentManager.getAgent(KNOWLEDGE_AGENT_ID)) {
    agentManager.register(knowledgeAgent);
  }
  if (!agentManager.getAgent(CONSISTENCY_AGENT_ID)) {
    agentManager.register(consistencyAgent);
  }
  agentManager.register(structuralMappingAgent);
  initialized = true;
}

export async function runStructuralMappingAgent(
  sourceExtraction: ImportedProtocolSource,
  options?: {
    trigger?: StructuralMappingAgentTrigger;
    onMapping?: StructuralMappingRuleOptions['onMapping'];
    onRejectedMapping?: StructuralMappingRuleOptions['onRejectedMapping'];
    onSuspiciousMapping?: StructuralMappingRuleOptions['onSuspiciousMapping'];
  },
): Promise<{ output: StructuralMappingAgentOutput; result: StructuralMappingResult }> {
  ensureAgentsRegistered();

  appendProtocolBuildEvent({ type: 'progress', message: 'Structural Mapping Agent started' });
  appendProtocolBuildEvent({ type: 'progress', message: 'Matching protocol headings to M11' });

  let mappedBatchBuffer: string[] = [];

  const flushMappedBatch = () => {
    if (mappedBatchBuffer.length === 0) {
      return;
    }
    appendProtocolBuildEvent({
      type: 'success',
      message: `Mapped ${mappedBatchBuffer.length} section(s): ${mappedBatchBuffer.join(', ')}`,
      metadata: { batchSize: mappedBatchBuffer.length },
    });
    mappedBatchBuffer = [];
  };

  try {
    const output = evaluateStructuralMapping(
      {
        sourceExtraction,
        m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
        trigger: options?.trigger ?? 'import',
      },
      {
        onMapping: (mapping) => {
          mappedBatchBuffer.push(`${mapping.mappedM11SectionId}←"${mapping.sourceHeading}"`);
          if (mappedBatchBuffer.length >= AGGREGATE_BATCH_SIZE) {
            flushMappedBatch();
          }
          options?.onMapping?.(mapping);
        },
        onRejectedMapping: (details) => {
          appendProtocolBuildEvent({
            type: 'warning',
            message: `Skipped mapping for ${details.mappedM11SectionId} from "${details.sourceHeading}": ${details.reason}`,
            sectionId: details.mappedM11SectionId,
          });
          options?.onRejectedMapping?.(details);
        },
        onSuspiciousMapping: (record) => {
          appendProtocolBuildEvent({
            type: 'warning',
            message: `Suspicious mapping skipped for ${record.mappedM11SectionId}: ${record.reason}`,
            sectionId: record.mappedM11SectionId,
          });
          options?.onSuspiciousMapping?.(record);
        },
      },
    );

    flushMappedBatch();

    if (output.mappingSummary.importedCount > 0) {
      appendProtocolBuildEvent({
        type: 'success',
        message: `${output.mappingSummary.importedCount} sections imported from source`,
        metadata: { importedCount: output.mappingSummary.importedCount },
      });
    }

    appendProtocolBuildEvent({
      type: 'info',
      message: `${output.mappingSummary.needsGenerationCount} sections require generation`,
      metadata: { needsGenerationCount: output.mappingSummary.needsGenerationCount },
    });

    if (output.mappingSummary.suspiciousCount > 0) {
      appendProtocolBuildEvent({
        type: 'warning',
        message: `${output.mappingSummary.suspiciousCount} suspicious mappings skipped`,
        metadata: { suspiciousCount: output.mappingSummary.suspiciousCount },
      });
    }

    appendProtocolBuildEvent({ type: 'success', message: 'Structural Mapping Agent completed' });

    return { output, result: toStructuralMappingResult(output) };
  } catch {
    const output = evaluateStructuralMapping({
      sourceExtraction,
      m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
      trigger: options?.trigger ?? 'import',
    });
    return { output, result: toStructuralMappingResult(output) };
  }
}

export { ensureAgentsRegistered as ensureStructuralMappingAgentsRegistered };
