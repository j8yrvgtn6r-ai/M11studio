import type { Agent } from './Agent';
import type { AgentContext } from './AgentContext';
import { createAgentEvent } from './agentEvents';
import { createAgentResult, type AgentResult } from './AgentResult';
import {
  evaluateValidation,
  type ValidationAgentInput,
  type ValidationAgentOutput,
} from './validationRules';

export const VALIDATION_AGENT_ID = 'validation-agent';

export type {
  StructuralSuggestion,
  TerminologySuggestion,
  ValidationAgentInput,
  ValidationAgentOutput,
  ValidationAgentTrigger,
  ValidationAttemptRecord,
  ValidationChange,
  ValidationChangeSeverity,
  ValidationChangeType,
} from './validationRules';

export { buildTrackChangeSegments, evaluateValidation, evaluateValidationFromDraft, getControlledTerminologySuggestions } from './validationRules';

export const validationAgent: Agent<ValidationAgentInput, ValidationAgentOutput> = {
  id: VALIDATION_AGENT_ID,
  label: 'Validation Agent',
  description: 'Proposes M11-compliant validation edits for imported and generated section text.',
  async execute(
    context: AgentContext<ValidationAgentInput>,
  ): Promise<AgentResult<ValidationAgentOutput>> {
    const startedAt = new Date().toISOString();
    const sectionLabel = context.input.sectionTitle || context.input.sectionId;
    const events = [
      createAgentEvent(VALIDATION_AGENT_ID, {
        type: 'progress',
        message: `Validation Agent started for Section ${sectionLabel}`,
        sectionId: context.input.sectionId,
      }),
      createAgentEvent(VALIDATION_AGENT_ID, {
        type: 'progress',
        message: 'Checking M11 structure',
        sectionId: context.input.sectionId,
      }),
      createAgentEvent(VALIDATION_AGENT_ID, {
        type: 'progress',
        message: 'Checking controlled terminology',
        sectionId: context.input.sectionId,
      }),
    ];

    try {
      if (!context.input.importedText.trim()) {
        events.push(
          createAgentEvent(VALIDATION_AGENT_ID, {
            type: 'info',
            message: `Validation Agent skipped — empty text for ${sectionLabel}`,
            sectionId: context.input.sectionId,
          }),
        );
        return createAgentResult(VALIDATION_AGENT_ID, startedAt, {
          status: 'skipped',
          output: {
            originalText: context.input.importedText,
            validatedText: context.input.importedText,
            changes: [],
            findings: [
              {
                code: 'empty_text',
                severity: 'error',
                message: 'Section has no text to validate.',
              },
            ],
            terminologySuggestions: [],
            structuralSuggestions: [],
            validationSummary: {
              changeCount: 0,
              findingCount: 1,
              terminologyCount: 0,
              structuralCount: 0,
              status: 'skipped',
            },
          },
          warnings: ['Empty section text'],
          events,
        });
      }

      if (!context.input.m11TemplateSection) {
        events.push(
          createAgentEvent(VALIDATION_AGENT_ID, {
            type: 'warning',
            message: `M11 template section missing for ${sectionLabel} — continuing with generic checks`,
            sectionId: context.input.sectionId,
          }),
        );
      }

      const output = evaluateValidation(context.input);

      if (output.validationSummary.status === 'failed') {
        events.push(
          createAgentEvent(VALIDATION_AGENT_ID, {
            type: 'error',
            message: `Validation failed for ${sectionLabel}`,
            sectionId: context.input.sectionId,
          }),
        );
        return createAgentResult(VALIDATION_AGENT_ID, startedAt, {
          status: 'failed',
          output,
          errors: output.findings.filter((finding) => finding.severity === 'error').map((finding) => finding.message),
          events,
        });
      }

      events.push(
        createAgentEvent(VALIDATION_AGENT_ID, {
          type: 'success',
          message: `Proposed ${output.validationSummary.changeCount} changes for ${sectionLabel}`,
          sectionId: context.input.sectionId,
          metadata: { changeCount: output.validationSummary.changeCount },
        }),
      );

      return createAgentResult(VALIDATION_AGENT_ID, startedAt, {
        status: output.changes.length > 0 || output.findings.length > 0 ? 'success' : 'partial',
        output,
        affectedSectionIds: [context.input.sectionId],
        events,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      events.push(
        createAgentEvent(VALIDATION_AGENT_ID, {
          type: 'error',
          message: `Validation Agent failed for ${sectionLabel}: ${message}`,
          sectionId: context.input.sectionId,
        }),
      );
      return createAgentResult(VALIDATION_AGENT_ID, startedAt, {
        status: 'failed',
        errors: [message],
        output: {
          originalText: context.input.importedText,
          validatedText: context.input.importedText,
          changes: [],
          findings: [
            {
              code: 'validation_error',
              severity: 'error',
              message,
            },
          ],
          terminologySuggestions: [],
          structuralSuggestions: [],
          validationSummary: {
            changeCount: 0,
            findingCount: 1,
            terminologyCount: 0,
            structuralCount: 0,
            status: 'failed',
          },
        },
        events,
      });
    }
  },
};
