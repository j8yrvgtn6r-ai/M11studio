import type { ProtocolDocument, ScheduleCacheMetadata } from '../types';
import { generateScheduleFromRules } from './generateScheduleFromRules';

export type ScheduleSourceSnapshot = {
  visitSchedule: ProtocolDocument['visitSchedule'];
  soaAssessmentDefinitions: ProtocolDocument['soaAssessmentDefinitions'];
  assessmentScheduleRules: ProtocolDocument['assessmentScheduleRules'];
  clinicalDesignLinks: {
    visitDefinitions: Array<{
      id: string;
      clinicalDesignVisitId: string | null;
    }>;
    soaAssessmentDefinitions: Array<{
      id: string;
      clinicalDesignAssessmentId: string | null;
    }>;
  };
};

function stableSortById<T extends { id: string }>(items: T[] | undefined): T[] {
  return [...(items ?? [])].sort((left, right) => left.id.localeCompare(right.id));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function hashString(input: string): string {
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Builds the deterministic source snapshot hashed for schedule cache staleness. */
export function buildScheduleSourceSnapshot(document: ProtocolDocument): ScheduleSourceSnapshot {
  const visitDefinitions = [...(document.visitSchedule?.visitDefinitions ?? [])].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });

  const assessmentScheduleRules = stableSortById(document.assessmentScheduleRules);
  const soaAssessmentDefinitions = stableSortById(document.soaAssessmentDefinitions);

  return {
    visitSchedule: {
      anchors: stableSortById(document.visitSchedule?.anchors),
      visitDefinitions,
    },
    soaAssessmentDefinitions,
    assessmentScheduleRules,
    clinicalDesignLinks: {
      visitDefinitions: visitDefinitions.map((visitDefinition) => ({
        id: visitDefinition.id,
        clinicalDesignVisitId: visitDefinition.clinicalDesignVisitId ?? null,
      })),
      soaAssessmentDefinitions: soaAssessmentDefinitions.map((definition) => ({
        id: definition.id,
        clinicalDesignAssessmentId: definition.clinicalDesignAssessmentId ?? null,
      })),
    },
  };
}

/** Computes a deterministic hash of schedule generation source layers. */
export function computeScheduleSourceHash(document: ProtocolDocument): string {
  return hashString(stableStringify(buildScheduleSourceSnapshot(document)));
}

/** Returns whether cached schedule metadata is missing or out of date with current sources. */
export function isScheduleCacheStale(document: ProtocolDocument): boolean {
  const cachedHash = document.schedule.metadata?.sourceHash;
  if (!cachedHash) {
    return true;
  }

  return cachedHash !== computeScheduleSourceHash(document);
}

function buildScheduleCacheMetadata(document: ProtocolDocument): ScheduleCacheMetadata {
  return {
    generatedFromRules: true,
    generatedAt: new Date().toISOString(),
    sourceHash: computeScheduleSourceHash(document),
    sourceRuleCount: document.assessmentScheduleRules?.length ?? 0,
    sourceVisitDefinitionCount: document.visitSchedule?.visitDefinitions?.length ?? 0,
    sourceSoAAssessmentDefinitionCount: document.soaAssessmentDefinitions?.length ?? 0,
  };
}

/** Writes a generated schedule into document.schedule with cache metadata. */
export function regenerateScheduleCacheInDocument(document: ProtocolDocument): void {
  const generated = generateScheduleFromRules(document);

  document.schedule = {
    visits: generated.visits,
    assessments: generated.assessments,
    cells: generated.cells,
    metadata: buildScheduleCacheMetadata(document),
  };
  document.metadata.updatedAt = new Date().toISOString();
}
