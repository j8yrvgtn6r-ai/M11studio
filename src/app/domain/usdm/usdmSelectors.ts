import type { StudyDesign } from '../study-design/StudyDesignTypes';
import { getStudyDesign } from '../study-design/StudyDesignStore';
import type { UsdmExportContext, UsdmExportCounts, UsdmExportReadiness, UsdmReadinessState } from './usdmExportTypes';
import { buildUsdmExportContext, mapStudyDesignToUsdm } from './usdmMapper';
import { validateUsdmExport } from './usdmValidation';
import type { UsdmDocument } from './usdmTypes';

export function countUsdmExportEntities(document: UsdmDocument): UsdmExportCounts {
  const design = document.study?.versions?.[0]?.studyDesigns?.[0];
  const timeline = design?.scheduleTimelines?.[0];
  const procedures =
    design?.activities?.reduce((sum, activity) => sum + (activity.definedProcedures?.length ?? 0), 0) ?? 0;

  return {
    arms: design?.arms?.length ?? 0,
    epochs: design?.epochs?.length ?? 0,
    elements: design?.elements?.length ?? 0,
    encounters: design?.encounters?.length ?? 0,
    activities: design?.activities?.length ?? 0,
    procedures,
    scheduleInstances: timeline?.instances?.length ?? 0,
    timings: timeline?.timings?.length ?? 0,
    scheduleTimelines: design?.scheduleTimelines?.length ?? 0,
  };
}

export function evaluateUsdmExportReadiness(
  studyDesign: StudyDesign | null = getStudyDesign(),
  context: UsdmExportContext = buildUsdmExportContext(),
): UsdmExportReadiness {
  if (!studyDesign) {
    return {
      state: 'notReady',
      counts: {
        arms: 0,
        epochs: 0,
        elements: 0,
        encounters: 0,
        activities: 0,
        procedures: 0,
        scheduleInstances: 0,
        timings: 0,
        scheduleTimelines: 0,
      },
      errors: [
        {
          code: 'missing_study_design',
          message: 'Build Study Design before exporting schedule data.',
          severity: 'error',
        },
      ],
      warnings: [],
      missingFields: ['Study Design'],
      blockingErrors: ['No Study Design model exists.'],
      message: 'Not ready — create Study Design first.',
    };
  }

  const document = mapStudyDesignToUsdm(studyDesign, context);
  const validation = validateUsdmExport(document);
  const counts = countUsdmExportEntities(document);

  const missingFields: string[] = [];
  if (!context.sponsorProtocolIdentifier) missingFields.push('Sponsor protocol identifier');
  if (!context.trialPhase) missingFields.push('Trial phase');
  if (counts.encounters === 0) missingFields.push('Visits');
  if (counts.activities === 0) missingFields.push('Activities');
  if (counts.epochs === 0) missingFields.push('Epochs');

  const blockingErrors = validation.errors.map((entry) => entry.message);
  let state: UsdmReadinessState = 'ready';
  if (validation.summary.errorCount > 0) {
    state = 'notReady';
  } else if (validation.summary.warningCount > 0 || missingFields.length > 0) {
    state = 'readyWithWarnings';
  }

  const message =
    state === 'ready'
      ? 'Schedule export is ready.'
      : state === 'readyWithWarnings'
        ? 'Schedule export is ready with warnings.'
        : 'Schedule export is not ready — resolve blocking issues first.';

  return {
    state,
    counts,
    errors: validation.errors,
    warnings: validation.warnings,
    missingFields,
    blockingErrors,
    message,
  };
}

export function getUsdmReadinessLabel(state: UsdmReadinessState): string {
  switch (state) {
    case 'ready':
      return 'Ready';
    case 'readyWithWarnings':
      return 'Ready with warnings';
    default:
      return 'Not ready';
  }
}
