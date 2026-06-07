import type { GeneratedSectionDraft } from '../import/types';
import type { ProtocolDocument, ProtocolSection, ValidationIssue } from '../../../types/protocol';
import { selectDependencyNodes } from '../selectors/toDependencyGraph';
import { stripHtmlToPlainText } from './richTextContent';
import { searchTerminology } from '../../terminology/terminologyService';
import {
  resolveControlledTerminologyStatus,
  resolveM11StructureStatus,
} from '../../../agents/validationRules';

export interface TerminologySuggestion {
  term: string;
  preferredTerm: string;
  codelistName: string;
  definition: string;
}

export interface SectionDependencyReference {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  relationshipLabel?: string;
  referencedBySectionId?: string;
  referencedBySectionTitle?: string;
}

export interface SectionValidationSummary {
  passes: boolean;
  structureIssueCount: number;
  terminologyIssueCount: number;
  missingRequiredCount: number;
  consistencyIssueCount: number;
  structureStatus: string;
  terminologyStatus: string;
  findings: { severity: string; message: string; code?: string }[];
}

export interface EditorGutterIndicator {
  lineNumber: number;
  kind: 'validation' | 'terminology' | 'structure' | 'info';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** Future IntelliSense hook — returns terminology suggestions for partial input. */
export function getTerminologySuggestions(partial: string, limit = 8): TerminologySuggestion[] {
  const query = partial.trim();
  if (query.length < 2) {
    return [];
  }
  const result = searchTerminology(query);
  return result.matches.slice(0, limit).map((match) => ({
    term: match.entry.preferredTerm,
    preferredTerm: match.entry.ichPreferredTerm,
    codelistName: match.entry.codelistName,
    definition: match.entry.definition,
  }));
}

function findSectionTitle(sections: ProtocolSection[], sectionId: string): string {
  for (const section of sections) {
    if (section.id === sectionId) {
      return section.title ?? section.id;
    }
    if (section.children?.length) {
      const found = findSectionTitle(section.children.filter(Boolean) as ProtocolSection[], sectionId);
      if (found !== sectionId) {
        return found;
      }
    }
  }
  return sectionId;
}

/** Read-only dependency awareness for the active section. */
export function getSectionDependencyReferences(
  sectionId: string | null,
  document: ProtocolDocument,
  sections: ProtocolSection[],
): SectionDependencyReference[] {
  if (!sectionId) {
    return [];
  }

  const nodes = selectDependencyNodes(document).filter((node) => node.sectionId === sectionId);
  if (nodes.length === 0) {
    return [];
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const references: SectionDependencyReference[] = [];

  for (const relationship of document.relationships) {
    if (!nodeIds.has(relationship.targetId)) {
      continue;
    }
    const sourceNode = selectDependencyNodes(document).find((node) => node.id === relationship.sourceId);
    references.push({
      nodeId: relationship.targetId,
      nodeType: nodes.find((node) => node.id === relationship.targetId)?.type ?? 'entity',
      nodeName: nodes.find((node) => node.id === relationship.targetId)?.name ?? relationship.targetId,
      relationshipLabel: relationship.label,
      referencedBySectionId: sourceNode?.sectionId,
      referencedBySectionTitle: sourceNode?.sectionId
        ? findSectionTitle(sections, sourceNode.sectionId)
        : undefined,
    });
  }

  for (const node of nodes) {
    references.push({
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name,
    });
  }

  return references;
}

export function buildSectionValidationSummary(
  sectionId: string | null,
  section: ProtocolSection | null,
  draft: GeneratedSectionDraft | undefined,
  validationIssues: ValidationIssue[],
): SectionValidationSummary {
  const sectionIssues = validationIssues.filter((issue) => issue.sectionId === sectionId);
  const draftFindings = draft?.validationFindings ?? [];
  const draftChanges = draft?.validationChanges ?? [];

  const structureStatus = draft ? resolveM11StructureStatus(draftFindings) : 'Not checked';
  const terminologyStatus = draft ? resolveControlledTerminologyStatus(draftChanges) : 'Not checked';

  const structureIssueCount = draftFindings.filter((finding) =>
    finding.code?.includes('structure') || finding.message.toLowerCase().includes('structure'),
  ).length;
  const terminologyIssueCount = draftFindings.filter((finding) =>
    finding.message.toLowerCase().includes('terminology') || finding.message.toLowerCase().includes('controlled'),
  ).length;
  const consistencyIssueCount = draftFindings.filter((finding) =>
    finding.message.toLowerCase().includes('consistency') || finding.message.toLowerCase().includes('sync'),
  ).length;

  let missingRequiredCount = 0;
  if (section?.status === 'requiredMissing') {
    missingRequiredCount += 1;
  }
  if (draft && !stripHtmlToPlainText(draft.generatedText ?? '').trim() && section?.status === 'requiredMissing') {
    missingRequiredCount += 1;
  }

  const findings = [
    ...sectionIssues.map((issue) => ({
      severity: issue.severity,
      message: issue.message,
      code: issue.name,
    })),
    ...draftFindings.map((finding) => ({
      severity: finding.severity,
      message: finding.message,
      code: finding.code,
    })),
  ];

  const issueTotal =
    structureIssueCount + terminologyIssueCount + missingRequiredCount + consistencyIssueCount + sectionIssues.length;

  return {
    passes: issueTotal === 0 && draft?.validationStatus !== 'failed',
    structureIssueCount,
    terminologyIssueCount,
    missingRequiredCount,
    consistencyIssueCount,
    structureStatus,
    terminologyStatus,
    findings,
  };
}

export function buildEditorGutterIndicators(
  content: string,
  summary: SectionValidationSummary,
): EditorGutterIndicator[] {
  const lines = stripHtmlToPlainText(content).split('\n');
  const indicators: EditorGutterIndicator[] = [];

  if (summary.passes && lines.filter((line) => line.trim()).length > 0) {
    indicators.push({
      lineNumber: 1,
      kind: 'validation',
      severity: 'info',
      message: 'Section passes validation checks',
    });
    return indicators;
  }

  if (summary.structureIssueCount > 0) {
    indicators.push({
      lineNumber: 1,
      kind: 'structure',
      severity: 'warning',
      message: `${summary.structureIssueCount} structure issue(s)`,
    });
  }
  if (summary.terminologyIssueCount > 0) {
    indicators.push({
      lineNumber: Math.min(2, lines.length),
      kind: 'terminology',
      severity: 'warning',
      message: `${summary.terminologyIssueCount} terminology issue(s)`,
    });
  }
  if (summary.missingRequiredCount > 0) {
    indicators.push({
      lineNumber: 1,
      kind: 'validation',
      severity: 'error',
      message: 'Required content missing',
    });
  }

  return indicators;
}
