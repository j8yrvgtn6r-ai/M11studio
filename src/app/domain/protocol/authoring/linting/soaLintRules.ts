import { getSoAKnowledge } from '../../../soa-knowledge/soaKnowledgeStore';
import { findSoAAssessmentByName, findSoAVisitByName } from '../../../soa-knowledge/soaKnowledgeSelectors';
import type { ProtocolLintContext, ProtocolLintIssue } from './protocolLintTypes';

const ASSESSMENT_PATTERN = /\b([A-Za-z][A-Za-z0-9\-/ ]{2,40}\s+(?:assessment|procedure|evaluation))\b/gi;
const VISIT_PATTERN = /\b(cycle\s+\d+\s+day\s+\d+|screening visit|baseline visit|week\s+\d+\s+visit)\b/gi;

function lineNumberFromOffset(text: string, offset: number): number {
  return Math.max(1, text.slice(0, Math.max(0, offset)).split('\n').length);
}

export function runSoALintRules(context: ProtocolLintContext): ProtocolLintIssue[] {
  const issues: ProtocolLintIssue[] = [];
  const soa = getSoAKnowledge();
  if (!soa) {
    return issues;
  }

  const text = context.plainText;
  let match: RegExpExecArray | null;

  const assessmentPattern = new RegExp(ASSESSMENT_PATTERN.source, ASSESSMENT_PATTERN.flags);
  while ((match = assessmentPattern.exec(text)) !== null) {
    const phrase = match[1]?.trim() ?? match[0];
    const known = findSoAAssessmentByName(soa, phrase);
    if (!known) {
      issues.push({
        id: `lint.soa.assessment.${match.index}`,
        sectionId: context.sectionId,
        lineNumber: lineNumberFromOffset(text, match.index),
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        severity: 'warning',
        category: 'soa',
        message: `Assessment "${phrase}" is mentioned but not found in SoA Knowledge.`,
        suggestedFix: phrase,
        source: 'soaKnowledge',
        relatedSectionIds: ['8'],
        createdAt: new Date().toISOString(),
      });
    }
  }

  const visitPattern = new RegExp(VISIT_PATTERN.source, VISIT_PATTERN.flags);
  while ((match = visitPattern.exec(text)) !== null) {
    const phrase = match[0].trim();
    const known = findSoAVisitByName(soa, phrase);
    if (!known) {
      issues.push({
        id: `lint.soa.visit.${match.index}`,
        sectionId: context.sectionId,
        lineNumber: lineNumberFromOffset(text, match.index),
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        severity: 'warning',
        category: 'soa',
        message: `Visit timing "${phrase}" is referenced but not found in SoA Knowledge.`,
        source: 'soaKnowledge',
        relatedSectionIds: ['8'],
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (context.sectionId === '8' && soa.assessments.length > 0) {
    const scheduledNames = new Set(soa.assessments.map((entry) => entry.name.toLowerCase()));
    const missingInNarrative = soa.assessments.filter(
      (assessment) => !text.toLowerCase().includes(assessment.name.toLowerCase()),
    );
    if (missingInNarrative.length > 0 && missingInNarrative.length <= scheduledNames.size) {
      const sample = missingInNarrative[0];
      if (sample) {
        issues.push({
          id: `lint.soa.unscheduled-desc.${sample.id}`,
          sectionId: context.sectionId,
          lineNumber: 1,
          severity: 'info',
          category: 'soa',
          message: `Scheduled assessment "${sample.name}" is not described in Section 8 narrative.`,
          source: 'soaKnowledge',
          relatedEntityIds: [sample.id],
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return issues;
}
