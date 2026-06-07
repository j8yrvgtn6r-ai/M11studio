import type { ValidationAgentOutput } from '../../../agents/validationRules';
import {
  resolveControlledTerminologyMessage,
} from '../../../agents/validationRules';
import { validateM11ControlledTerm } from '../ichM11/ichM11ControlledTerminology';
import type { FieldDefinition } from '../../../types/protocol';
import type { GeneratedSectionDraft } from '../import/types';
import {
  evaluateTitlePageCompletion,
  isTitlePageFieldValueComplete,
  TITLE_PAGE_REQUIRED_FIELD_IDS,
  TITLE_PAGE_SECTION_ID,
} from './titlePageAuthoring';

const TITLE_PAGE_CONTROLLED_FIELDS: { fieldId: string; codelistId: string; label: string }[] = [
  { fieldId: 'title_page.trial_phase', codelistId: 'C217045', label: 'Trial Phase' },
  {
    fieldId: 'title_page.original_protocol_indicator',
    codelistId: 'C217046',
    label: 'Original Protocol Indicator',
  },
];

/** Serializes structured title-page fields into a stable validation snapshot. */
export function serializeTitlePageFieldsToText(fields: FieldDefinition[]): string {
  const titleFields = fields.filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID);
  const lines: string[] = [];

  for (const fieldId of TITLE_PAGE_REQUIRED_FIELD_IDS) {
    const field = titleFields.find((entry) => entry.id === fieldId);
    const value = field?.value === undefined || field?.value === null ? '' : String(field.value);
    lines.push(`${field?.label ?? fieldId}: ${value.trim()}`);
  }

  return lines.join('\n');
}

function buildManualTitlePageDraft(fields: FieldDefinition[]): GeneratedSectionDraft {
  const narrative = serializeTitlePageFieldsToText(fields);
  const now = new Date().toISOString();
  return {
    sectionId: TITLE_PAGE_SECTION_ID,
    title: 'Title Page',
    generatedText: narrative,
    sourceText: narrative,
    sourceUploadId: 'manual',
    sourceExtractionId: 'manual',
    knowledgeModelId: '',
    matchedSourceCandidateIds: [],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'title-page-authoring-v1',
      generationTimestamp: now,
      generationPromptVersion: 'title-page-v1',
      sourceUploadId: 'manual',
      knowledgeModelId: '',
      sourceCandidateIds: [],
      confidence: 1,
      generationNotes: ['Authored via structured Title Page fields'],
      knowledgeElementsUsed: [],
      draftVersion: 1,
    },
    draftVersion: 1,
    state: 'pendingReview',
    stateChangedAt: now,
    stateChangedBy: 'Current user',
    stateHistory: [
      {
        state: 'pendingReview',
        changedAt: now,
        changedBy: 'Current user',
        note: 'Title Page structured authoring',
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

/** Ensures an import draft exists for Title Page workflow tracking. */
export function ensureTitlePageAuthoringDraft(fields: FieldDefinition[]): GeneratedSectionDraft {
  return buildManualTitlePageDraft(fields);
}

/** Validates structured Title Page fields (required content + controlled terminology). */
export function buildTitlePageValidationOutput(fields: FieldDefinition[]): ValidationAgentOutput {
  const summary = evaluateTitlePageCompletion(fields);
  const narrative = serializeTitlePageFieldsToText(fields);

  if (!summary.allRequiredComplete) {
    return {
      originalText: narrative,
      validatedText: narrative,
      changes: [],
      findings: [
        {
          code: 'required_fields_missing',
          severity: 'error',
          message: `Title Page is missing required fields (${summary.missingFieldIds.join(', ')}).`,
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
    };
  }

  const findings = [
    {
      code: 'title_page_structure',
      severity: 'info' as const,
      message: 'Title Page required structured fields are complete.',
    },
  ];

  for (const check of TITLE_PAGE_CONTROLLED_FIELDS) {
    const field = fields.find((entry) => entry.id === check.fieldId);
    const value = field?.value === undefined || field?.value === null ? '' : String(field.value);
    const result = validateM11ControlledTerm(check.codelistId, value);
    findings.push({
      code: 'controlled_terminology',
      severity: result.valid ? ('info' as const) : ('error' as const),
      message: `${check.label}: ${result.message}`,
    });
  }

  for (const fieldId of TITLE_PAGE_REQUIRED_FIELD_IDS) {
    const field = fields.find((entry) => entry.id === fieldId);
    if (!isTitlePageFieldValueComplete(fieldId, field?.value)) {
      continue;
    }
    if (TITLE_PAGE_CONTROLLED_FIELDS.some((entry) => entry.fieldId === fieldId)) {
      continue;
    }
    findings.push({
      code: 'field_complete',
      severity: 'info' as const,
      message: `${field?.label ?? fieldId} is complete.`,
    });
  }

  findings.push({
    code: 'controlled_terminology',
    severity: 'info' as const,
    message: resolveControlledTerminologyMessage([]),
  });

  const hasError = findings.some((finding) => finding.severity === 'error');

  return {
    originalText: narrative,
    validatedText: narrative,
    changes: [],
    findings,
    terminologySuggestions: [],
    structuralSuggestions: [],
    validationSummary: {
      changeCount: 0,
      findingCount: findings.length,
      terminologyCount: 0,
      structuralCount: 0,
      status: hasError ? 'failed' : 'proposed',
    },
  };
}
