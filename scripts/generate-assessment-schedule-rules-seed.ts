import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function collectSectionIds(sections: Array<{ id: string; children?: Array<{ id: string; children?: unknown[] }> }>): Set<string> {
  const ids = new Set<string>();

  function walk(nodes: typeof sections): void {
    for (const node of nodes) {
      ids.add(node.id);
      if (node.children?.length) {
        walk(node.children as typeof sections);
      }
    }
  }

  walk(sections);
  return ids;
}

const seedPath = join(__dirname, '../src/app/domain/protocol/seed/PROTO-XYZ-301.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as {
  sections: Array<{ id: string; children?: Array<{ id: string; children?: unknown[] }> }>;
  schedule: {
    cells: Array<{ visitId: string; assessmentId: string; required: boolean; notes?: string }>;
    assessments: Array<{ id: string; linkedSectionId?: string }>;
  };
  visitSchedule: { visitDefinitions: Array<{ id: string; metadata?: { scheduleVisitId?: string } }> };
};

const sectionIds = collectSectionIds(seed.sections);

const visitDefinitionByScheduleVisitId = new Map<string, string>();
for (const visitDefinition of seed.visitSchedule.visitDefinitions) {
  const scheduleVisitId = visitDefinition.metadata?.scheduleVisitId;
  if (scheduleVisitId) {
    visitDefinitionByScheduleVisitId.set(scheduleVisitId, visitDefinition.id);
  }
}

const assessmentSections = new Map(
  seed.schedule.assessments
    .filter((assessment) => assessment.linkedSectionId)
    .map((assessment) => [assessment.id, assessment.linkedSectionId as string])
);

const assessmentById = new Map(
  seed.schedule.assessments.map((assessment) => [assessment.id, assessment])
);

const rules = seed.schedule.cells.map((cell) => {
  const visitDefinitionId = visitDefinitionByScheduleVisitId.get(cell.visitId);
  if (!visitDefinitionId) {
    throw new Error(`No visit definition mapped for schedule visit ${cell.visitId}`);
  }

  const scheduleAssessment = assessmentById.get(cell.assessmentId);
  const rule: Record<string, unknown> = {
    id: `asr-${cell.visitId}-${cell.assessmentId}`,
    assessmentId: cell.assessmentId,
    visitDefinitionId,
    required: cell.required,
    relativeTiming: 'at-visit',
    metadata: {
      scheduleVisitId: cell.visitId,
      scheduleAssessmentId: cell.assessmentId,
      assessmentRefKind: 'schedule',
      ...(scheduleAssessment?.entityId
        ? { clinicalDesignAssessmentId: scheduleAssessment.entityId }
        : {}),
    },
  };

  const sourceSectionId = assessmentSections.get(cell.assessmentId);
  if (sourceSectionId && sectionIds.has(sourceSectionId)) {
    rule.sourceSectionId = sourceSectionId;
  } else if (sourceSectionId) {
    rule.metadata = {
      ...(rule.metadata as Record<string, unknown>),
      linkedSectionRef: sourceSectionId,
    };
  }

  if (cell.notes) {
    rule.timingNote = cell.notes;
  }

  if (cell.assessmentId === 'a8' && (cell.visitId === 'v6' || cell.visitId === 'v8')) {
    rule.independentOfDoseDelay = true;
    rule.timingNote = 'Every 8 weeks from first dose, independent of dose delays';
  }

  return rule;
});

seed.assessmentScheduleRules = rules;
writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

console.log(`Updated ${seedPath} with ${rules.length} assessmentScheduleRules.`);
