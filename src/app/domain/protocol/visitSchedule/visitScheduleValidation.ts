import type { ProtocolDocument, ScheduleAnchor, VisitDefinition } from '../types';
import { CLINICAL_DESIGN_COLLECTION_KEYS } from '../clinicalDesign/constants';
import {
  isRollingReanchorPolicy,
  isValidScheduleOffset,
  isValidVisitWindowBound,
} from './guards';

export interface VisitScheduleValidationMessage {
  code: string;
  message: string;
  path?: string;
}

function collectClinicalDesignVisitIds(document: ProtocolDocument): Set<string> {
  const ids = new Set<string>();

  for (const collectionKey of CLINICAL_DESIGN_COLLECTION_KEYS) {
    if (collectionKey !== 'visits') {
      continue;
    }

    const visits = document.clinicalDesign.visits;
    if (visits?.length) {
      for (const visit of visits) {
        ids.add(visit.id);
      }
    }
  }

  return ids;
}

function buildAnchorById(anchors: ScheduleAnchor[] | undefined): Map<string, ScheduleAnchor> {
  const anchorById = new Map<string, ScheduleAnchor>();
  anchors?.forEach((anchor) => {
    anchorById.set(anchor.id, anchor);
  });
  return anchorById;
}

function visitUsesRollingSchedule(
  visitDefinition: VisitDefinition,
  anchorById: Map<string, ScheduleAnchor>
): boolean {
  const anchor = anchorById.get(visitDefinition.anchorId);
  if (anchor?.anchorType === 'previous-visit') {
    return true;
  }

  return isRollingReanchorPolicy(visitDefinition.reanchorPolicy);
}

function visitHasFixedSchedulePolicy(visitDefinition: VisitDefinition): boolean {
  return (
    visitDefinition.preserveOriginalSchedule === true ||
    visitDefinition.reanchorPolicy === 'preserveOriginalAnchor'
  );
}

function visitRequiresRipplePolicy(
  visitDefinition: VisitDefinition,
  anchorById: Map<string, ScheduleAnchor>
): boolean {
  const anchor = anchorById.get(visitDefinition.anchorId);
  if (anchor?.anchorType === 'previous-visit') {
    return true;
  }

  return (
    visitDefinition.reanchorPolicy === 'reanchorToActualVisitDate' &&
    visitDefinition.visitType === 'treatment'
  );
}

function validateVisitDefinitionTimingAndPolicy(
  visitDefinition: VisitDefinition,
  path: string,
  anchorById: Map<string, ScheduleAnchor>,
  errors: VisitScheduleValidationMessage[]
): void {
  if (
    visitDefinition.windowBeforeDays !== undefined &&
    !isValidVisitWindowBound(visitDefinition.windowBeforeDays)
  ) {
    errors.push({
      code: 'invalid_visit_window_before_days',
      path: `${path}.windowBeforeDays`,
      message: 'windowBeforeDays must be a non-negative number when provided',
    });
  }

  if (
    visitDefinition.windowAfterDays !== undefined &&
    !isValidVisitWindowBound(visitDefinition.windowAfterDays)
  ) {
    errors.push({
      code: 'invalid_visit_window_after_days',
      path: `${path}.windowAfterDays`,
      message: 'windowAfterDays must be a non-negative number when provided',
    });
  }

  const offsetFields: Array<keyof Pick<
    VisitDefinition,
    'offsetDays' | 'offsetWeeks' | 'offsetCycles' | 'nominalDay' | 'nominalWeek'
  >> = ['offsetDays', 'offsetWeeks', 'offsetCycles', 'nominalDay', 'nominalWeek'];

  for (const field of offsetFields) {
    const value = visitDefinition[field];
    if (value !== undefined && !isValidScheduleOffset(value)) {
      errors.push({
        code: 'invalid_visit_schedule_offset',
        path: `${path}.${field}`,
        message: `${field} must be a finite number when provided`,
      });
    }
  }

  const rolling = visitUsesRollingSchedule(visitDefinition, anchorById);

  if (!rolling && !visitHasFixedSchedulePolicy(visitDefinition)) {
    errors.push({
      code: 'fixed_visit_policy_required',
      path,
      message:
        'Fixed schedule visits must set preserveOriginalSchedule to true or reanchorPolicy to preserveOriginalAnchor',
    });
  }

  if (rolling) {
    const reanchorPolicy = visitDefinition.reanchorPolicy;
    if (reanchorPolicy === 'preserveOriginalAnchor') {
      errors.push({
        code: 'rolling_visit_reanchor_policy_conflict',
        path: `${path}.reanchorPolicy`,
        message: 'Rolling schedule visits cannot use preserveOriginalAnchor',
      });
    }

    if (visitRequiresRipplePolicy(visitDefinition, anchorById)) {
      if (visitDefinition.ripplePolicy === 'noRipple' || visitDefinition.ripplePolicy === undefined) {
        errors.push({
          code: 'ripple_undefined_for_rolling',
          path: `${path}.ripplePolicy`,
          message: 'Rolling re-anchor visits require a ripplePolicy other than noRipple',
        });
      }
    }
  }
}

function validateAnchorSourceVisitReferences(
  anchors: ScheduleAnchor[] | undefined,
  visitDefinitions: VisitDefinition[] | undefined,
  errors: VisitScheduleValidationMessage[]
): void {
  const visitById = new Map<string, VisitDefinition>();
  visitDefinitions?.forEach((visitDefinition) => {
    visitById.set(visitDefinition.id, visitDefinition);
  });

  anchors?.forEach((anchor, index) => {
    if (!anchor.sourceVisitId || anchor.anchorType !== 'previous-visit') {
      return;
    }

    const path = `visitSchedule.anchors[${index}].sourceVisitId`;
    const sourceVisit = visitById.get(anchor.sourceVisitId);
    if (!sourceVisit) {
      return;
    }

    if (sourceVisit.anchorId === anchor.id) {
      errors.push({
        code: 'schedule_anchor_self_reference',
        path,
        message: `sourceVisitId "${anchor.sourceVisitId}" cannot reference a visit anchored to the same previous-visit schedule anchor`,
      });
    }

    const visitedVisitIds = new Set<string>([anchor.sourceVisitId]);
    let currentVisit: VisitDefinition | undefined = sourceVisit;

    while (currentVisit) {
      const currentAnchor = anchors.find((item) => item.id === currentVisit?.anchorId);
      if (!currentAnchor?.sourceVisitId || currentAnchor.anchorType !== 'previous-visit') {
        break;
      }

      if (visitedVisitIds.has(currentAnchor.sourceVisitId)) {
        errors.push({
          code: 'schedule_anchor_source_visit_cycle',
          path,
          message: `previous-visit sourceVisitId chain starting at "${anchor.sourceVisitId}" creates a cycle`,
        });
        break;
      }

      visitedVisitIds.add(currentAnchor.sourceVisitId);
      currentVisit = visitById.get(currentAnchor.sourceVisitId);
    }
  });
}

/** Validates visit schedule anchors and visit definitions in a protocol document. */
export function validateVisitSchedule(
  document: ProtocolDocument,
  errors: VisitScheduleValidationMessage[],
  warnings: VisitScheduleValidationMessage[]
): void {
  if (!document.visitSchedule) {
    errors.push({
      code: 'missing_visit_schedule',
      path: 'visitSchedule',
      message: 'visitSchedule is required',
    });
    return;
  }

  const { anchors, visitDefinitions } = document.visitSchedule;
  const seenAnchorIds = new Map<string, string>();
  const seenVisitDefinitionIds = new Map<string, string>();
  const seenSoaColumnIds = new Map<string, string>();
  const visitDefinitionIds = new Set<string>();
  const clinicalDesignVisitIds = collectClinicalDesignVisitIds(document);
  const anchorById = buildAnchorById(anchors);

  anchors?.forEach((anchor, index) => {
    const path = `visitSchedule.anchors[${index}]`;
    const previousPath = seenAnchorIds.get(anchor.id);

    if (previousPath) {
      errors.push({
        code: 'duplicate_schedule_anchor_id',
        path,
        message: `Duplicate schedule anchor id "${anchor.id}" (also declared at ${previousPath})`,
      });
    } else {
      seenAnchorIds.set(anchor.id, path);
    }
  });

  visitDefinitions?.forEach((visitDefinition, index) => {
    const path = `visitSchedule.visitDefinitions[${index}]`;
    const previousPath = seenVisitDefinitionIds.get(visitDefinition.id);

    if (previousPath) {
      errors.push({
        code: 'duplicate_visit_definition_id',
        path,
        message: `Duplicate visit definition id "${visitDefinition.id}" (also declared at ${previousPath})`,
      });
    } else {
      seenVisitDefinitionIds.set(visitDefinition.id, path);
    }

    visitDefinitionIds.add(visitDefinition.id);

    if (!visitDefinition.anchorId?.trim()) {
      errors.push({
        code: 'visit_missing_anchor',
        path: `${path}.anchorId`,
        message: 'anchorId is required for visit definitions',
      });
      return;
    }

    if (!seenAnchorIds.has(visitDefinition.anchorId)) {
      errors.push({
        code: 'invalid_visit_definition_anchor',
        path: `${path}.anchorId`,
        message: `anchorId "${visitDefinition.anchorId}" does not match any schedule anchor id`,
      });
    }

    if (
      visitDefinition.clinicalDesignVisitId &&
      !clinicalDesignVisitIds.has(visitDefinition.clinicalDesignVisitId)
    ) {
      errors.push({
        code: 'invalid_visit_definition_clinical_design_ref',
        path: `${path}.clinicalDesignVisitId`,
        message: `clinicalDesignVisitId "${visitDefinition.clinicalDesignVisitId}" does not match any clinical design visit id`,
      });
    }

    validateVisitDefinitionTimingAndPolicy(visitDefinition, path, anchorById, errors);

    if (visitDefinition.displayLabel !== undefined && !visitDefinition.displayLabel.trim()) {
      errors.push({
        code: 'invalid_visit_definition_display_label',
        path: `${path}.displayLabel`,
        message: 'displayLabel must be a non-empty string when provided',
      });
    }

    if (visitDefinition.timepointDisplay !== undefined && !visitDefinition.timepointDisplay.trim()) {
      errors.push({
        code: 'invalid_visit_definition_timepoint_display',
        path: `${path}.timepointDisplay`,
        message: 'timepointDisplay must be a non-empty string when provided',
      });
    }

    if (visitDefinition.soaColumnId) {
      const previousSoaColumnPath = seenSoaColumnIds.get(visitDefinition.soaColumnId);
      if (previousSoaColumnPath) {
        errors.push({
          code: 'duplicate_visit_definition_soa_column_id',
          path: `${path}.soaColumnId`,
          message: `Duplicate soaColumnId "${visitDefinition.soaColumnId}" (also declared at ${previousSoaColumnPath})`,
        });
      } else {
        seenSoaColumnIds.set(visitDefinition.soaColumnId, path);
      }

      const metadataScheduleVisitId = visitDefinition.metadata?.scheduleVisitId;
      if (
        typeof metadataScheduleVisitId === 'string' &&
        metadataScheduleVisitId !== visitDefinition.soaColumnId
      ) {
        warnings.push({
          code: 'visit_definition_soa_column_id_metadata_mismatch',
          path: `${path}.soaColumnId`,
          message: `soaColumnId "${visitDefinition.soaColumnId}" disagrees with metadata.scheduleVisitId "${metadataScheduleVisitId}"`,
        });
      }
    }
  });

  anchors?.forEach((anchor, index) => {
    if (!anchor.sourceVisitId) {
      return;
    }

    if (!visitDefinitionIds.has(anchor.sourceVisitId)) {
      errors.push({
        code: 'invalid_schedule_anchor_source_visit',
        path: `visitSchedule.anchors[${index}].sourceVisitId`,
        message: `sourceVisitId "${anchor.sourceVisitId}" does not match any visit definition id`,
      });
    }
  });

  validateAnchorSourceVisitReferences(anchors, visitDefinitions, errors);

  if (!anchors?.length) {
    warnings.push({
      code: 'visit_schedule_no_anchors',
      path: 'visitSchedule.anchors',
      message: 'Visit schedule has no anchors defined',
    });
  }

  if (!visitDefinitions?.length) {
    warnings.push({
      code: 'visit_schedule_no_visit_definitions',
      path: 'visitSchedule.visitDefinitions',
      message: 'Visit schedule has no visit definitions defined',
    });
  }
}
