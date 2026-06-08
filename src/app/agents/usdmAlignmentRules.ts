import { getStudyDesign } from '../domain/study-design/StudyDesignStore';
import { validateStudyDesign } from '../domain/study-design/StudyDesignValidation';
import { buildUsdmExportContext } from '../domain/usdm/usdmMapper';
import { evaluateUsdmExportReadiness } from '../domain/usdm/usdmSelectors';

export interface UsdmAlignmentSuggestion {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  entityKind?: string;
  entityId?: string;
  suggestedFix?: string;
}

export interface UsdmAlignmentInput {
  includeExportReadiness?: boolean;
}

export interface UsdmAlignmentOutput {
  suggestions: UsdmAlignmentSuggestion[];
  readinessState: 'notReady' | 'readyWithWarnings' | 'ready';
  summary: string;
}

export function inspectUsdmAlignmentGaps(
  input: UsdmAlignmentInput = {},
): UsdmAlignmentOutput {
  const studyDesign = getStudyDesign();
  const context = buildUsdmExportContext();
  const suggestions: UsdmAlignmentSuggestion[] = [];

  if (!studyDesign) {
    return {
      suggestions: [
        {
          id: 'missing-study-design',
          severity: 'error',
          message: 'No Study Design exists yet.',
          suggestedFix: 'Build Study Design from narrative, knowledge graph, or manual entry.',
        },
      ],
      readinessState: 'notReady',
      summary: 'Study Design required before schedule export.',
    };
  }

  const validation = validateStudyDesign(studyDesign);
  for (const issue of validation.issues) {
    suggestions.push({
      id: `study-design-${issue.field}-${issue.entityId ?? issue.message}`,
      severity: issue.severity === 'error' ? 'error' : 'warning',
      message: issue.message,
      entityKind: issue.entityKind,
      entityId: issue.entityId,
      suggestedFix: issue.severity === 'error' ? 'Resolve validation error in Study Design.' : undefined,
    });
  }

  for (const visit of studyDesign.visits) {
    if (!visit.epochId) {
      suggestions.push({
        id: `visit-no-epoch-${visit.id}`,
        severity: 'warning',
        message: `Visit ${visit.name} has no epoch.`,
        entityKind: 'visit',
        entityId: visit.id,
        suggestedFix: 'Assign the visit to an epoch in Study Design.',
      });
    }
  }

  for (const activity of studyDesign.activities) {
    suggestions.push({
      id: `activity-procedure-${activity.id}`,
      severity: 'info',
      message: `Activity ${activity.name} will use a placeholder procedure on export.`,
      entityKind: 'activity',
      entityId: activity.id,
    });
  }

  if (!context.trialPhase) {
    suggestions.push({
      id: 'missing-trial-phase',
      severity: 'warning',
      message: 'Trial Phase missing from Title Page.',
      suggestedFix: 'Complete the Trial Phase field on the Title Page.',
    });
  }

  if (!context.sponsorProtocolIdentifier) {
    suggestions.push({
      id: 'missing-protocol-id',
      severity: 'warning',
      message: 'Sponsor protocol identifier missing from Title Page.',
      suggestedFix: 'Complete the Sponsor Protocol Identifier on the Title Page.',
    });
  }

  const readiness = input.includeExportReadiness === false
    ? null
    : evaluateUsdmExportReadiness(studyDesign, context);

  for (const warning of readiness?.warnings ?? []) {
    suggestions.push({
      id: `usdm-${warning.code}-${warning.entityId ?? warning.path ?? warning.message}`,
      severity: 'warning',
      message: warning.message,
      entityId: warning.entityId,
    });
  }

  for (const error of readiness?.errors ?? []) {
    suggestions.push({
      id: `usdm-${error.code}-${error.entityId ?? error.path ?? error.message}`,
      severity: 'error',
      message: error.message,
      entityId: error.entityId,
      suggestedFix: 'Fix export-blocking issue before downloading USDM JSON.',
    });
  }

  const readinessState = readiness?.state ?? 'notReady';
  const errorCount = suggestions.filter((item) => item.severity === 'error').length;
  const warningCount = suggestions.filter((item) => item.severity === 'warning').length;

  return {
    suggestions,
    readinessState,
    summary: `${suggestions.length} suggestion(s): ${errorCount} blocking, ${warningCount} warnings.`,
  };
}
