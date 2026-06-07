import type { ValidationIssue } from '../../../types/protocol';
import type { GeneratedSectionDraft, SectionValidationFinding, ValidationChange } from '../import/types';
import { buildEntityDiagnostics } from '../entities/protocolEntitySelectors';
import { getKnowledgeGraph } from '../../knowledge-graph/knowledgeGraphStore';
import { stripHtmlToPlainText } from './richTextContent';

export type LineDiagnosticSeverity = 'info' | 'warning' | 'error';

export type LineDiagnosticCategory =
  | 'structure'
  | 'terminology'
  | 'consistency'
  | 'entity'
  | 'missingContent'
  | 'grammar'
  | 'soa';

export interface LineDiagnostic {
  id: string;
  sectionId: string;
  lineNumber: number;
  startOffset?: number;
  endOffset?: number;
  severity: LineDiagnosticSeverity;
  category: LineDiagnosticCategory;
  message: string;
  source: string;
  suggestedFix?: string;
  relatedEntityIds?: string[];
  relatedSectionIds?: string[];
}

export interface LineDiagnosticsInput {
  sectionId: string;
  content: string;
  draft?: GeneratedSectionDraft;
  validationIssues?: ValidationIssue[];
}

/** Navigation target when a validation panel diagnostic is clicked. */
export interface DiagnosticScrollTarget {
  sectionId: string;
  lineNumber: number;
  startOffset?: number;
  requestId: number;
  suggestedFix?: string;
}

let diagnosticCounter = 0;

function nextDiagnosticId(prefix: string): string {
  diagnosticCounter += 1;
  return `${prefix}-${diagnosticCounter}`;
}

export function lineNumberFromOffset(text: string, offset: number): number {
  return Math.max(1, text.slice(0, Math.max(0, offset)).split('\n').length);
}

export function offsetFromLineColumn(text: string, lineNumber: number, column = 0): number {
  const lines = text.split('\n');
  const index = Math.max(0, lineNumber - 1);
  let offset = 0;
  for (let i = 0; i < index && i < lines.length; i += 1) {
    offset += lines[i].length + 1;
  }
  return offset + column;
}

function inferCategory(
  code?: string,
  message?: string,
  changeType?: ValidationChange['type'],
): LineDiagnosticCategory {
  const haystack = `${code ?? ''} ${message ?? ''}`.toLowerCase();
  if (changeType === 'terminology' || haystack.includes('terminology') || haystack.includes('controlled')) {
    return 'terminology';
  }
  if (haystack.includes('consistency') || haystack.includes('sync') || haystack.includes('out of sync')) {
    return 'consistency';
  }
  if (haystack.includes('required') || haystack.includes('missing')) {
    return 'missingContent';
  }
  if (haystack.includes('soa') || haystack.includes('schedule')) {
    return 'soa';
  }
  if (haystack.includes('grammar') || haystack.includes('formatting')) {
    return 'grammar';
  }
  return 'structure';
}

function findBestEffortSpan(
  text: string,
  needle?: string,
  startIndex?: number,
  endIndex?: number,
): { startOffset: number; endOffset: number; lineNumber: number } | null {
  if (typeof startIndex === 'number' && typeof endIndex === 'number' && endIndex > startIndex) {
    return {
      startOffset: startIndex,
      endOffset: endIndex,
      lineNumber: lineNumberFromOffset(text, startIndex),
    };
  }

  const query = needle?.trim();
  if (!query) {
    return null;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) {
    return null;
  }

  return {
    startOffset: index,
    endOffset: index + query.length,
    lineNumber: lineNumberFromOffset(text, index),
  };
}

function pushDiagnostic(
  diagnostics: LineDiagnostic[],
  input: Omit<LineDiagnostic, 'id'>,
): void {
  diagnostics.push({ ...input, id: nextDiagnosticId('diag') });
}

/** Maps validation findings/changes/issues to best-effort line diagnostics. */
export function buildLineDiagnostics(input: LineDiagnosticsInput): LineDiagnostic[] {
  const plainText = stripHtmlToPlainText(input.content);
  const diagnostics: LineDiagnostic[] = [];
  const { sectionId, draft, validationIssues = [] } = input;

  for (const issue of validationIssues.filter((entry) => entry.sectionId === sectionId)) {
    const span = findBestEffortSpan(plainText, issue.message);
    pushDiagnostic(diagnostics, {
      sectionId,
      lineNumber: span?.lineNumber ?? 1,
      startOffset: span?.startOffset,
      endOffset: span?.endOffset,
      severity: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info',
      category: inferCategory(issue.name, issue.message),
      message: issue.message,
      source: 'validation',
      suggestedFix: issue.quickFix?.label,
      relatedEntityIds: issue.fieldId ? [issue.fieldId] : undefined,
    });
  }

  for (const finding of draft?.validationFindings ?? []) {
    addFindingDiagnostic(diagnostics, sectionId, plainText, finding);
  }

  for (const change of draft?.validationChanges ?? []) {
    const span = findBestEffortSpan(
      plainText,
      change.originalText,
      change.startIndex,
      change.endIndex,
    );
    pushDiagnostic(diagnostics, {
      sectionId,
      lineNumber: span?.lineNumber ?? 1,
      startOffset: span?.startOffset,
      endOffset: span?.endOffset,
      severity: change.severity === 'error' ? 'error' : change.severity === 'warning' ? 'warning' : 'info',
      category: inferCategory(undefined, change.reason, change.type),
      message: change.reason || `${change.type} change proposed`,
      source: change.type === 'terminology' ? 'M11 terminology' : 'validation',
      suggestedFix: change.replacementText,
    });
  }

  for (const entry of draft?.terminologyAcceptanceLog ?? []) {
    const span = findBestEffortSpan(plainText, entry.acceptedTerm);
    pushDiagnostic(diagnostics, {
      sectionId,
      lineNumber: span?.lineNumber ?? 1,
      startOffset: span?.startOffset,
      endOffset: span?.endOffset,
      severity: 'info',
      category: 'terminology',
      message: `Accepted M11 term "${entry.acceptedTerm}" (${entry.codelistName})`,
      source: 'terminologySuggestionAccepted',
      suggestedFix: entry.preferredTerm,
    });
  }

  const entityReferences = (draft?.entityReferences ?? []).map((entry) => ({
    entityId: entry.entityId,
    entityType: entry.entityType as import('../entities/protocolEntityTypes').ProtocolEntityType,
    displayText: entry.displayText,
    sectionId: entry.sectionId,
    offset: entry.offset,
    endOffset: entry.endOffset,
    createdAt: entry.createdAt,
  }));
  for (const entityDiagnostic of buildEntityDiagnostics({
    sectionId,
    content: plainText,
    references: entityReferences,
    knowledgeGraph: getKnowledgeGraph(),
  })) {
    pushDiagnostic(diagnostics, {
      sectionId,
      lineNumber: entityDiagnostic.startOffset != null
        ? lineNumberFromOffset(plainText, entityDiagnostic.startOffset)
        : 1,
      startOffset: entityDiagnostic.startOffset,
      endOffset: entityDiagnostic.endOffset,
      severity: entityDiagnostic.severity,
      category: 'entity',
      message: entityDiagnostic.message,
      source: 'protocolEntity',
      suggestedFix: entityDiagnostic.suggestedFix,
      relatedEntityIds: entityDiagnostic.relatedEntityIds ?? (entityDiagnostic.entityId ? [entityDiagnostic.entityId] : undefined),
    });
  }

  if (diagnostics.length === 0 && !plainText.trim()) {
    pushDiagnostic(diagnostics, {
      sectionId,
      lineNumber: 1,
      severity: 'error',
      category: 'missingContent',
      message: 'Required section content is missing.',
      source: 'validation',
    });
  }

  return dedupeDiagnostics(diagnostics);
}

function addFindingDiagnostic(
  diagnostics: LineDiagnostic[],
  sectionId: string,
  plainText: string,
  finding: SectionValidationFinding,
): void {
  const span = findBestEffortSpan(plainText, finding.suggestedTerm ?? finding.message);
  pushDiagnostic(diagnostics, {
    sectionId,
    lineNumber: span?.lineNumber ?? 1,
    startOffset: span?.startOffset,
    endOffset: span?.endOffset,
    severity: finding.severity === 'error' ? 'error' : finding.severity === 'warning' ? 'warning' : 'info',
    category: inferCategory(finding.code, finding.message),
    message: finding.message,
    source: finding.code?.includes('terminology') ? 'M11 terminology' : 'validation',
    suggestedFix: finding.suggestedTerm,
  });
}

function dedupeDiagnostics(diagnostics: LineDiagnostic[]): LineDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((entry) => {
    const key = `${entry.lineNumber}:${entry.category}:${entry.message}:${entry.startOffset ?? 0}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function diagnosticsForLine(diagnostics: LineDiagnostic[], lineNumber: number): LineDiagnostic[] {
  return diagnostics.filter((entry) => entry.lineNumber === lineNumber);
}

export function diagnosticsToGutterIndicators(
  diagnostics: LineDiagnostic[],
): { lineNumber: number; severity: LineDiagnosticSeverity; message: string; category: LineDiagnosticCategory }[] {
  const byLine = new Map<number, LineDiagnostic>();
  for (const diagnostic of diagnostics) {
    const existing = byLine.get(diagnostic.lineNumber);
    if (!existing || severityRank(diagnostic.severity) > severityRank(existing.severity)) {
      byLine.set(diagnostic.lineNumber, diagnostic);
    }
  }
  return [...byLine.values()].map((entry) => ({
    lineNumber: entry.lineNumber,
    severity: entry.severity,
    message: entry.message,
    category: entry.category,
  }));
}

function severityRank(severity: LineDiagnosticSeverity): number {
  switch (severity) {
    case 'error':
      return 3;
    case 'warning':
      return 2;
    default:
      return 1;
  }
}
