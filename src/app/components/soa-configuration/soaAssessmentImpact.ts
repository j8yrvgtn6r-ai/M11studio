import type { AssessmentScheduleRule, VisitDefinition } from '../../domain/protocol/types';
import type { Assessment, SoACell } from '../../types/protocol';

export interface SoAAssessmentGeneratedImpact {
  ruleCount: number;
  requiredRuleCount: number;
  visitCount: number;
  requiredCellCount: number;
  optionalCellCount: number;
  generatedRowLabel: string | null;
  generatedRowCategory: string | null;
  generatedLinkedSectionId: string | undefined;
}

export interface SoAAssessmentVisitAppearance {
  visitDefinitionId: string;
  visitLabel: string;
  soaColumnId: string | undefined;
  required: boolean;
  ruleId: string;
}

export function buildAssessmentVisitAppearances(
  rules: AssessmentScheduleRule[],
  visitById: Map<string, VisitDefinition>,
): SoAAssessmentVisitAppearance[] {
  return rules.map((rule) => {
    const visit = visitById.get(rule.visitDefinitionId);
    return {
      visitDefinitionId: rule.visitDefinitionId,
      visitLabel: visit?.displayLabel ?? visit?.name ?? rule.visitDefinitionId,
      soaColumnId: visit?.soaColumnId,
      required: rule.required,
      ruleId: rule.id,
    };
  });
}

export function computeSoAAssessmentGeneratedImpact(
  assessmentId: string,
  rules: AssessmentScheduleRule[],
  cells: SoACell[],
  generatedAssessments: Assessment[],
): SoAAssessmentGeneratedImpact {
  const assessmentCells = cells.filter((cell) => cell.assessmentId === assessmentId);
  const generatedRow = generatedAssessments.find((assessment) => assessment.id === assessmentId) ?? null;
  const uniqueVisitIds = new Set(rules.map((rule) => rule.visitDefinitionId));

  return {
    ruleCount: rules.length,
    requiredRuleCount: rules.filter((rule) => rule.required).length,
    visitCount: uniqueVisitIds.size,
    requiredCellCount: assessmentCells.filter((cell) => cell.required).length,
    optionalCellCount: assessmentCells.filter((cell) => !cell.required).length,
    generatedRowLabel: generatedRow?.label ?? null,
    generatedRowCategory: generatedRow?.category ?? null,
    generatedLinkedSectionId: generatedRow?.linkedSectionId,
  };
}

export function collectLinkedSectionReferences(
  linkedSectionId: string | undefined,
  rules: AssessmentScheduleRule[],
): string[] {
  const sections = new Set<string>();
  if (linkedSectionId) {
    sections.add(linkedSectionId);
  }
  for (const rule of rules) {
    if (rule.sourceSectionId) {
      sections.add(rule.sourceSectionId);
    }
  }
  return [...sections];
}
