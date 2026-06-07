import { updateSectionGenerationState } from '../build/protocolBuildConsoleStore';
import {
  hasSubstantiveEditorContent,
  sanitizeEditorContentForStorage,
  normalizeStoredRichText,
} from '../authoring/richTextContent';
import type { GeneratedSectionDraft, SectionGenerationProvenance } from './types';
import {
  clearSectionImportDraft,
  getProtocolImportState,
  updateSectionImportDraft,
  upsertSectionImportDraft,
} from './protocolImportStore';
import { flagSoARefreshNeededForNarrativeSection } from '../../soa-knowledge/soaNarrativeSyncStore';
import { getSoAFieldsImpactedByNarrativeSection } from '../../soa-knowledge/soaKnowledgeNarrativeSync';

function buildManualProvenance(): SectionGenerationProvenance {
  const now = new Date().toISOString();
  return {
    generationProvider: 'local-deterministic',
    generationModel: 'manual-authoring-v1',
    generationTimestamp: now,
    generationPromptVersion: 'manual-authoring-v1',
    sourceUploadId: 'manual',
    knowledgeModelId: '',
    sourceCandidateIds: [],
    confidence: 1,
    generationNotes: ['Authored manually in M11 Studio'],
    knowledgeElementsUsed: [],
    draftVersion: 1,
  };
}

function createManualDraft(sectionId: string, sectionTitle: string, generatedText = ''): GeneratedSectionDraft {
  const now = new Date().toISOString();
  return {
    sectionId,
    title: sectionTitle,
    generatedText,
    sourceUploadId: 'manual',
    sourceExtractionId: 'manual',
    knowledgeModelId: '',
    matchedSourceCandidateIds: [],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'local-deterministic',
    provenance: buildManualProvenance(),
    draftVersion: 1,
    state: 'pendingReview',
    stateChangedAt: now,
    stateChangedBy: 'Current user',
    stateHistory: [
      {
        state: 'pendingReview',
        changedAt: now,
        changedBy: 'Current user',
        note: 'Manual section authoring started',
      },
    ],
    generatedAt: now,
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
    workflowState: 'importedUnvalidated',
    contentOrigin: 'manual',
  };
}

/** Resolves the text shown in the section editor (import, generate, validate, manual). */
export function resolveSectionEditorContent(draft: GeneratedSectionDraft | undefined): string {
  if (!draft) {
    return '';
  }
  if (draft.generatedText?.trim()) {
    return normalizeStoredRichText(draft.generatedText);
  }
  if (draft.sourceText?.trim()) {
    return normalizeStoredRichText(draft.sourceText);
  }
  if (draft.validatedTargetText?.trim()) {
    return normalizeStoredRichText(draft.validatedTargetText);
  }
  return normalizeStoredRichText(
    draft.generatedText ?? draft.sourceText ?? draft.validatedTargetText ?? '',
  );
}

export function sectionHasSubstantiveContent(draft: GeneratedSectionDraft | undefined): boolean {
  if (!draft) {
    return false;
  }
  return hasSubstantiveEditorContent(resolveSectionEditorContent(draft));
}

/** Ensures a manual section draft exists for blank authoring. */
export function ensureManualSectionDraft(
  sectionId: string,
  sectionTitle: string,
  initialText = '',
): GeneratedSectionDraft {
  const existing = getProtocolImportState().sectionDrafts[sectionId];
  if (existing) {
    return existing;
  }
  const draft = createManualDraft(sectionId, sectionTitle, initialText);
  upsertSectionImportDraft(sectionId, draft);
  return getProtocolImportState().sectionDrafts[sectionId] ?? draft;
}

/** Persists a manual edit and resets validation workflow when needed. */
export function applyManualSectionContentEdit(
  sectionId: string,
  sectionTitle: string,
  generatedText: string,
  previousText?: string,
): void {
  const normalizedText = sanitizeEditorContentForStorage(generatedText);
  const current = getProtocolImportState().sectionDrafts[sectionId];
  const baselineText = sanitizeEditorContentForStorage(
    previousText ?? (current ? resolveSectionEditorContent(current) : ''),
  );

  if (normalizedText === baselineText) {
    return;
  }

  const substantive = hasSubstantiveEditorContent(normalizedText);
  const baselineSubstantive = hasSubstantiveEditorContent(baselineText);

  if (!substantive) {
    if (!current) {
      return;
    }
    if (current.contentOrigin === 'manual' && !current.sourceText?.trim()) {
      clearSectionImportDraft(sectionId);
      return;
    }
    updateSectionImportDraft(sectionId, {
      generatedText: normalizedText,
      workflowState: 'needsGeneration',
      validationStatus: 'not-run',
      validationFindings: [],
      validationMessages: [],
      validatedTargetText: undefined,
      validationChanges: undefined,
    });
    return;
  }

  if (!current) {
    upsertSectionImportDraft(sectionId, createManualDraft(sectionId, sectionTitle, normalizedText));
    return;
  }

  const wasValidated =
    current.workflowState === 'validated' ||
    current.state === 'validationPassed' ||
    current.state === 'approved';
  const isImported = current.contentOrigin === 'imported';
  const now = new Date().toISOString();

  const provenance: SectionGenerationProvenance | undefined =
    isImported && current.provenance
      ? {
          ...current.provenance,
          generationNotes: [
            ...(current.provenance.generationNotes ?? []),
            'Manually edited after import; pending re-validation',
          ],
        }
      : current.provenance;

  updateSectionImportDraft(sectionId, {
    generatedText: normalizedText,
    generatedAt: now,
    contentOrigin: isImported ? 'imported' : current.contentOrigin ?? 'manual',
    sourceText: current.sourceText,
    sourceHeading: current.sourceHeading,
    sourceSectionId: current.sourceSectionId,
    sourceHeadingLevel: current.sourceHeadingLevel,
    sourceStartIndex: current.sourceStartIndex,
    provenance,
    workflowState:
      wasValidated || isImported || current.contentOrigin === 'manual' || baselineSubstantive
        ? 'importedUnvalidated'
        : 'generated',
    validatedTargetText: wasValidated ? undefined : current.validatedTargetText,
    validationChanges: wasValidated ? undefined : current.validationChanges,
    validationFindings: wasValidated ? [] : current.validationFindings,
    validationStatus: wasValidated ? 'not-run' : current.validationStatus,
    state: wasValidated ? 'pendingReview' : current.state,
  });

  if (wasValidated) {
    updateSectionGenerationState(sectionId, 'importedUnvalidated');
  }

  if (getSoAFieldsImpactedByNarrativeSection(sectionId).length > 0) {
    flagSoARefreshNeededForNarrativeSection(sectionId);
  }
}
