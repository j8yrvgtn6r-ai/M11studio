import { agentManager } from './AgentManager';
import { ensureAgentsRegistered } from './consistencyAgentRunner';
import { getIchM11TemplateSpecById } from '../domain/protocol/ichM11/ichM11Template';
import { appendProtocolBuildEvent } from '../domain/protocol/build/protocolBuildConsoleStore';
import { getStudyModel } from '../domain/study-model/studyModelStore';
import { getProtocolDocument } from '../domain/protocol/store/protocolStore';
import {
  VALIDATION_AGENT_ID,
  validationAgent,
  type ValidationAgentInput,
  type ValidationAgentOutput,
  type ValidationAgentTrigger,
} from './ValidationAgent';
import type { GeneratedSectionDraft } from '../domain/protocol/import/types';

let initialized = false;

async function loadImportStore() {
  return import('../domain/protocol/import/protocolImportStore');
}

function ensureValidationAgentRegistered(): void {
  if (initialized) {
    return;
  }
  ensureAgentsRegistered();
  if (!agentManager.getAgent(VALIDATION_AGENT_ID)) {
    agentManager.register(validationAgent);
  }
  initialized = true;
}

function resolveValidationTrigger(draft: GeneratedSectionDraft): ValidationAgentTrigger {
  if (draft.contentOrigin === 'generated') {
    return 'validateGenerated';
  }
  if (draft.workflowState === 'validated' || draft.state === 'validationPassed') {
    return 'validateEdited';
  }
  return 'validateImported';
}

export async function runValidationAgentForSection(
  sectionId: string,
  actor = 'Current user',
): Promise<ValidationAgentOutput | null> {
  ensureValidationAgentRegistered();
  const store = await loadImportStore();
  const draft = store.getSectionImportDrafts()[sectionId];
  if (!draft) {
    return null;
  }

  const baseText = (draft.sourceText ?? draft.generatedText).trim();
  const sectionLabel = draft.title || sectionId;

  appendProtocolBuildEvent({
    type: 'progress',
    message: `Validation Agent started for Section ${sectionLabel}`,
    sectionId,
    sectionTitle: draft.title,
  });
  appendProtocolBuildEvent({
    type: 'progress',
    message: 'Checking M11 structure',
    sectionId,
  });
  appendProtocolBuildEvent({
    type: 'progress',
    message: 'Checking controlled terminology',
    sectionId,
  });

  try {
    const trigger = resolveValidationTrigger(draft);
    const input: ValidationAgentInput = {
      sectionId,
      sectionTitle: draft.title,
      importedText: baseText,
      m11TemplateSection: getIchM11TemplateSpecById(sectionId),
      controlledTerminology: true,
      studyModel: getStudyModel(),
      trigger,
    };

    const result = await agentManager.runAgent<ValidationAgentInput, ValidationAgentOutput>(
      VALIDATION_AGENT_ID,
      {
        protocolDocument: getProtocolDocument(),
        selectedSectionId: sectionId,
        studyModel: getStudyModel(),
        currentSectionText: baseText,
        trigger: 'sectionValidation',
        input,
      },
    );

    if (result.status === 'failed' || result.output.validationSummary.status === 'failed') {
      store.applyValidationAgentFailure(sectionId, result.output, actor);
      appendProtocolBuildEvent({
        type: 'error',
        message: `Validation failed for ${sectionLabel}`,
        sectionId,
      });
      return result.output;
    }

    if (result.status === 'skipped') {
      store.applyValidationAgentFailure(sectionId, result.output, actor);
      appendProtocolBuildEvent({
        type: 'warning',
        message: `Validation skipped for ${sectionLabel}`,
        sectionId,
      });
      return result.output;
    }

    if (store.isValidationTextUnchanged(baseText, result.output.validatedText)) {
      store.applyValidationNoChangesRequired(sectionId, result.output, actor);
      appendProtocolBuildEvent({
        type: 'success',
        message: 'Validation complete — no changes required.',
        sectionId,
        sectionTitle: draft.title,
      });
      return result.output;
    }

    store.applyValidationAgentProposal(sectionId, result.output, actor);
    appendProtocolBuildEvent({
      type: 'success',
      message: `Proposed ${result.output.validationSummary.changeCount} changes for ${sectionLabel}`,
      sectionId,
      metadata: { changeCount: result.output.validationSummary.changeCount },
    });
    return result.output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    store.applyValidationAgentFailure(
      sectionId,
      {
        originalText: baseText,
        validatedText: baseText,
        changes: [],
        findings: [{ code: 'validation_error', severity: 'error', message }],
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
      actor,
    );
    appendProtocolBuildEvent({
      type: 'error',
      message: `Validation failed for ${sectionLabel}: ${message}`,
      sectionId,
    });
    return null;
  }
}

export function emitValidationAccepted(sectionId: string, sectionTitle?: string): void {
  appendProtocolBuildEvent({
    type: 'success',
    message: `Validation accepted for ${sectionTitle ?? sectionId}`,
    sectionId,
    sectionTitle,
  });
}

export function emitValidationRejected(sectionId: string, sectionTitle?: string): void {
  appendProtocolBuildEvent({
    type: 'info',
    message: `Validation rejected for ${sectionTitle ?? sectionId}`,
    sectionId,
    sectionTitle,
  });
}

export { ensureValidationAgentRegistered };

export async function runLlmValidationAgentForSection(
  sectionId: string,
  actor = 'Current user',
): Promise<ValidationAgentOutput | null> {
  ensureValidationAgentRegistered();
  const store = await loadImportStore();
  const draft = store.getSectionImportDrafts()[sectionId];
  if (!draft) {
    store.clearLlmValidationInProgress(sectionId);
    return null;
  }

  const baseText = (draft.sourceText ?? draft.generatedText).trim();
  const sectionLabel = draft.title || sectionId;
  const { runLlmSectionValidation, getLlmValidationHelpMessage, isLlmValidationAvailable } = await import(
    '../domain/protocol/import/llm/llmValidationProvider'
  );

  if (!isLlmValidationAvailable()) {
    store.clearLlmValidationInProgress(sectionId);
    throw new Error(getLlmValidationHelpMessage());
  }

  appendProtocolBuildEvent({
    type: 'progress',
    message: `LLM Validation started for Section ${sectionLabel}`,
    sectionId,
    sectionTitle: draft.title,
  });

  const configModule = await import('../domain/protocol/import/llm/llmConfig');
  const providerLabel = configModule.getLlmValidationAvailability().providerLabel ?? 'LLM provider';
  appendProtocolBuildEvent({
    type: 'progress',
    message: `Sending section to ${providerLabel}`,
    sectionId,
  });

  try {
    const { output, provider, model } = await runLlmSectionValidation({
      sectionId,
      sectionTitle: draft.title,
      importedText: baseText,
    });

    if (output.validationSummary.status === 'failed') {
      store.clearLlmValidationInProgress(sectionId);
      appendProtocolBuildEvent({
        type: 'error',
        message: `LLM Validation failed for ${sectionLabel}`,
        sectionId,
      });
      return output;
    }

    if (store.isValidationTextUnchanged(baseText, output.validatedText)) {
      store.applyValidationNoChangesRequired(sectionId, output, actor);
      store.clearLlmValidationInProgress(sectionId);
      appendProtocolBuildEvent({
        type: 'success',
        message: 'Validation complete — no changes required.',
        sectionId,
        sectionTitle: draft.title,
      });
      return output;
    }

    store.applyValidationAgentProposal(sectionId, output, actor, { provider, model });
    appendProtocolBuildEvent({
      type: 'success',
      message: `LLM Validation proposed ${output.validationSummary.changeCount} changes for ${sectionLabel}`,
      sectionId,
      metadata: { changeCount: output.validationSummary.changeCount },
    });
    return output;
  } catch (error) {
    store.clearLlmValidationInProgress(sectionId);
    const message = error instanceof Error ? error.message : String(error);
    appendProtocolBuildEvent({
      type: 'error',
      message: `LLM Validation failed for ${sectionLabel}: ${message}`,
      sectionId,
    });
    throw error;
  }
}
