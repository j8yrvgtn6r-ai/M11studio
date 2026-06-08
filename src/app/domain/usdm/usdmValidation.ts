import type { UsdmDocument } from './usdmTypes';
import type { UsdmValidationIssue, UsdmValidationResult } from './usdmExportTypes';

function issue(
  code: string,
  message: string,
  severity: UsdmValidationIssue['severity'],
  path?: string,
  entityId?: string,
): UsdmValidationIssue {
  return { code, message, severity, path, entityId };
}

function collectIds(document: UsdmDocument): Map<string, string[]> {
  const ids = new Map<string, string[]>();
  const add = (id: string | undefined | null, path: string) => {
    if (!id) return;
    ids.set(id, [...(ids.get(id) ?? []), path]);
  };

  const study = document.study;
  add(study.id, 'study.id');
  for (const version of study.versions ?? []) {
    add(version.id, `study.versions[${version.id}]`);
    for (const design of version.studyDesigns ?? []) {
      add(design.id, `studyDesigns[${design.id}]`);
      for (const arm of design.arms ?? []) add(arm.id, `arms[${arm.id}]`);
      for (const epoch of design.epochs ?? []) add(epoch.id, `epochs[${epoch.id}]`);
      for (const element of design.elements ?? []) add(element.id, `elements[${element.id}]`);
      for (const encounter of design.encounters ?? []) add(encounter.id, `encounters[${encounter.id}]`);
      for (const activity of design.activities ?? []) {
        add(activity.id, `activities[${activity.id}]`);
        for (const procedure of activity.definedProcedures ?? []) {
          add(procedure.id, `activities[${activity.id}].definedProcedures[${procedure.id}]`);
        }
      }
      for (const timeline of design.scheduleTimelines ?? []) {
        add(timeline.id, `scheduleTimelines[${timeline.id}]`);
        for (const timing of timeline.timings ?? []) add(timing.id, `timings[${timing.id}]`);
        for (const instance of timeline.instances ?? []) add(instance.id, `instances[${instance.id}]`);
      }
    }
  }
  return ids;
}

export function validateUsdmExport(document: UsdmDocument): UsdmValidationResult {
  const errors: UsdmValidationIssue[] = [];
  const warnings: UsdmValidationIssue[] = [];

  if (!document.study) {
    errors.push(issue('missing_study', 'USDM export is missing study.', 'error', 'study'));
    return finalize(errors, warnings);
  }

  const study = document.study;
  if (!study.versions?.length) {
    errors.push(issue('missing_study_version', 'USDM export is missing study version.', 'error', 'study.versions'));
    return finalize(errors, warnings);
  }

  const version = study.versions[0];
  if (!version.studyDesigns?.length) {
    errors.push(
      issue('missing_study_design', 'USDM export is missing study design.', 'error', 'studyDesigns'),
    );
    return finalize(errors, warnings);
  }

  const design = version.studyDesigns[0];
  const timingIds = new Set<string>();
  for (const timeline of design.scheduleTimelines ?? []) {
    for (const timing of timeline.timings ?? []) {
      timingIds.add(timing.id);
    }
  }

  if (!version.studyIdentifiers?.length) {
    warnings.push(
      issue('missing_protocol_identifier', 'Protocol identifier missing from export context.', 'warning', 'studyIdentifiers'),
    );
  }

  if (!design.studyPhase?.decode?.trim()) {
    warnings.push(
      issue('missing_trial_phase', 'Trial phase missing from Title Page / export context.', 'warning', 'studyPhase'),
    );
  }

  for (const arm of design.arms ?? []) {
    if (!arm.type?.decode?.trim() && !arm.type?.code?.trim()) {
      warnings.push(
        issue('arm_without_type', `Arm "${arm.name}" has no type code.`, 'warning', `arms[${arm.id}]`, arm.id),
      );
    }
  }

  for (const epoch of design.epochs ?? []) {
    if (!epoch.type?.decode?.trim() && !epoch.type?.code?.trim()) {
      warnings.push(
        issue('epoch_without_type', `Epoch "${epoch.name}" has no type code.`, 'warning', `epochs[${epoch.id}]`, epoch.id),
      );
    }
  }

  for (const activity of design.activities ?? []) {
    if (!activity.definedProcedures?.length) {
      warnings.push(
        issue(
          'activity_without_procedure',
          `Activity "${activity.name}" has no procedure mapping.`,
          'warning',
          `activities[${activity.id}]`,
          activity.id,
        ),
      );
    }
  }

  for (const encounter of design.encounters ?? []) {
    if (!encounter.scheduledAtId) {
      errors.push(
        issue(
          'encounter_missing_scheduled_at',
          `Encounter "${encounter.name}" has no scheduledAtId.`,
          'error',
          `encounters[${encounter.id}]`,
          encounter.id,
        ),
      );
    } else if (!timingIds.has(encounter.scheduledAtId)) {
      errors.push(
        issue(
          'encounter_missing_timing',
          `Encounter "${encounter.name}" references missing timing "${encounter.scheduledAtId}".`,
          'error',
          `encounters[${encounter.id}].scheduledAtId`,
          encounter.id,
        ),
      );
    }

    if (!encounter.epochId) {
      warnings.push(
        issue(
          'visit_without_epoch',
          `Visit "${encounter.label ?? encounter.name}" has no epoch assignment.`,
          'warning',
          `encounters[${encounter.id}]`,
          encounter.id,
        ),
      );
    }
  }

  for (const timeline of design.scheduleTimelines ?? []) {
    for (const instance of timeline.instances ?? []) {
      if (!instance.encounterId) {
        errors.push(
          issue(
            'scheduled_instance_missing_encounter',
            `Scheduled instance "${instance.name}" has no encounterId.`,
            'error',
            `instances[${instance.id}]`,
            instance.id,
          ),
        );
      }
      if (!instance.activityIds?.length) {
        errors.push(
          issue(
            'scheduled_instance_missing_activities',
            `Scheduled instance "${instance.name}" has no activityIds.`,
            'error',
            `instances[${instance.id}]`,
            instance.id,
          ),
        );
      }
      if (!instance.epochId) {
        errors.push(
          issue(
            'scheduled_instance_missing_epoch',
            `Scheduled instance "${instance.name}" has no epochId.`,
            'error',
            `instances[${instance.id}]`,
            instance.id,
          ),
        );
      }
    }
  }

  const idMap = collectIds(document);
  for (const [id, paths] of idMap.entries()) {
    if (paths.length > 1) {
      errors.push(
        issue(
          'duplicate_id',
          `Duplicate USDM id "${id}" used at: ${paths.join(', ')}.`,
          'error',
          paths[0],
          id,
        ),
      );
    }
  }

  return finalize(errors, warnings);
}

function finalize(errors: UsdmValidationIssue[], warnings: UsdmValidationIssue[]): UsdmValidationResult {
  const errorCount = errors.length;
  const warningCount = warnings.length;
  const status = errorCount > 0 ? 'errors' : warningCount > 0 ? 'warnings' : 'valid';
  return {
    errors,
    warnings,
    summary: { errorCount, warningCount, status },
  };
}

export function summarizeUsdmReference(json: unknown): {
  arms: number;
  epochs: number;
  elements: number;
  encounters: number;
  activities: number;
  scheduleTimelines: number;
  timings: number;
  scheduledInstances: number;
  studyDesignCount: number;
  studyVersionCount: number;
} {
  const root = json as { study?: { versions?: Array<{ studyDesigns?: Array<Record<string, unknown>> }> } };
  const versions = root.study?.versions ?? [];
  const designs = versions.flatMap((version) => version.studyDesigns ?? []);
  const design = designs[0] ?? {};
  const timelines = (design.scheduleTimelines as Array<{ timings?: unknown[]; instances?: unknown[] }>) ?? [];

  return {
    studyVersionCount: versions.length,
    studyDesignCount: designs.length,
    arms: Array.isArray(design.arms) ? design.arms.length : 0,
    epochs: Array.isArray(design.epochs) ? design.epochs.length : 0,
    elements: Array.isArray(design.elements) ? design.elements.length : 0,
    encounters: Array.isArray(design.encounters) ? design.encounters.length : 0,
    activities: Array.isArray(design.activities) ? design.activities.length : 0,
    scheduleTimelines: timelines.length,
    timings: timelines.reduce((sum, timeline) => sum + (timeline.timings?.length ?? 0), 0),
    scheduledInstances: timelines.reduce((sum, timeline) => sum + (timeline.instances?.length ?? 0), 0),
  };
}
