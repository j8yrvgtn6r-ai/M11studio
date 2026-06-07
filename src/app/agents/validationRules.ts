import { getIchM11TemplateSpecById } from '../domain/protocol/ichM11/ichM11Template';
import { ICH_M11_TECHNICAL_SPEC_SECTION_SPECS } from '../domain/protocol/ichM11/ichM11TechnicalSpecification';
import { getM11Codelists } from '../domain/protocol/ichM11/ichM11ControlledTerminology';
import type { IchM11SectionSpec } from '../domain/protocol/ichM11/types';
import { validateGeneratedSectionDraft } from '../domain/protocol/import/sectionDraftValidation';
import type {
  GeneratedSectionDraft,
  SectionValidationFinding,
  ValidationAttemptRecord,
  ValidationChange,
  ValidationChangeSeverity,
  ValidationChangeType,
} from '../domain/protocol/import/types';
import type { StudyModel } from '../domain/study-model/studyModelTypes';

export type {
  ValidationAttemptRecord,
  ValidationChange,
  ValidationChangeSeverity,
  ValidationChangeType,
} from '../domain/protocol/import/types';

export interface TerminologySuggestion {
  foundTerm: string;
  suggestedTerm: string;
  reason: string;
  source: 'ICH M11 Controlled Terminology';
  terminologyCode?: string;
}

export interface StructuralSuggestion {
  code: string;
  message: string;
  severity: ValidationChangeSeverity;
}

export type ValidationAgentTrigger =
  | 'validateImported'
  | 'validateEdited'
  | 'validateGenerated'
  | 'manual';

export interface ValidationAgentInput {
  sectionId: string;
  sectionTitle: string;
  importedText: string;
  m11TemplateSection?: IchM11SectionSpec;
  m11TechnicalSpecificationContext?: IchM11SectionSpec[];
  controlledTerminology?: boolean;
  studyModel?: StudyModel | null;
  trigger: ValidationAgentTrigger;
}

export interface ValidationAgentOutput {
  originalText: string;
  validatedText: string;
  changes: ValidationChange[];
  findings: SectionValidationFinding[];
  terminologySuggestions: TerminologySuggestion[];
  structuralSuggestions: StructuralSuggestion[];
  validationSummary: {
    changeCount: number;
    findingCount: number;
    terminologyCount: number;
    structuralCount: number;
    status: 'proposed' | 'skipped' | 'failed';
  };
}

interface TextTransformRule {
  id: string;
  pattern: RegExp;
  replacement: string;
  reason: string;
  type: ValidationChangeType;
  severity: ValidationChangeSeverity;
  terminologyCode?: string;
}

const TERMINOLOGY_EXPANSIONS: TextTransformRule[] = [
  {
    id: 'os-expansion',
    pattern: /\boverall survival\b(?!\s*\(OS\))/gi,
    replacement: 'overall survival (OS)',
    reason: 'Expand overall survival with standard abbreviation (OS)',
    type: 'terminology',
    severity: 'info',
    terminologyCode: 'OS',
  },
  {
    id: 'pfs-expansion',
    pattern: /\bprogression-free survival\b(?!\s*\(PFS\))/gi,
    replacement: 'progression-free survival (PFS)',
    reason: 'Expand progression-free survival with standard abbreviation (PFS)',
    type: 'terminology',
    severity: 'info',
    terminologyCode: 'PFS',
  },
  {
    id: 'ae-expansion',
    pattern: /\badverse events?\b(?!\s*\(AEs?\))/gi,
    replacement: 'adverse events (AEs)',
    reason: 'Harmonize adverse event language to controlled terminology',
    type: 'terminology',
    severity: 'info',
    terminologyCode: 'AE',
  },
];

const HARMONIZATION_RULES: TextTransformRule[] = [
  {
    id: 'subjects-to-participants',
    pattern: /\bsubjects\b/gi,
    replacement: 'participants',
    reason: 'M11 prefers participants over subjects',
    type: 'terminology',
    severity: 'warning',
  },
  {
    id: 'subject-to-participant',
    pattern: /\bsubject\b/gi,
    replacement: 'participant',
    reason: 'M11 prefers participant over subject',
    type: 'terminology',
    severity: 'warning',
  },
  {
    id: 'investigational-product',
    pattern: /\binvestigational products?\b/gi,
    replacement: 'investigational trial intervention',
    reason: 'Harmonize to ICH M11 investigational trial intervention terminology',
    type: 'terminology',
    severity: 'warning',
  },
  {
    id: 'study-to-trial',
    pattern: /\b(the|this|a)\s+study\b/gi,
    replacement: '$1 trial',
    reason: 'M11 narrative prefers trial over study where appropriate',
    type: 'terminology',
    severity: 'info',
  },
];

const FORMATTING_RULES: TextTransformRule[] = [
  {
    id: 'collapse-blank-lines',
    pattern: /\n{3,}/g,
    replacement: '\n\n',
    reason: 'Collapse excessive blank lines',
    type: 'formatting',
    severity: 'info',
  },
  {
    id: 'trim-trailing-space',
    pattern: /[ \t]+(\n|$)/g,
    replacement: '$1',
    reason: 'Remove trailing whitespace',
    type: 'formatting',
    severity: 'info',
  },
];

const PLACEHOLDER_PATTERN = /\[(?:insert|enter|provide|add|describe|specify)[^\]]*\]/gi;

let changeCounter = 0;

function nextChangeId(prefix: string): string {
  changeCounter += 1;
  return `${prefix}-${changeCounter}`;
}

function applyTransformRules(
  text: string,
  rules: TextTransformRule[],
): { text: string; changes: ValidationChange[]; suggestions: TerminologySuggestion[] } {
  let next = text;
  const changes: ValidationChange[] = [];
  const suggestions: TerminologySuggestion[] = [];

  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(next)) !== null) {
      const originalFragment = match[0];
      const replacementFragment = originalFragment.replace(pattern, rule.replacement);
      if (originalFragment === replacementFragment) {
        continue;
      }
      const startIndex = match.index;
      next = `${next.slice(0, startIndex)}${replacementFragment}${next.slice(startIndex + originalFragment.length)}`;
      pattern.lastIndex = startIndex + replacementFragment.length;

      const change: ValidationChange = {
        id: nextChangeId(rule.id),
        type: rule.type,
        originalText: originalFragment,
        replacementText: replacementFragment,
        reason: rule.reason,
        startIndex,
        endIndex: startIndex + originalFragment.length,
        terminologyCode: rule.terminologyCode,
        severity: rule.severity,
      };
      changes.push(change);

      if (rule.type === 'terminology') {
        suggestions.push({
          foundTerm: originalFragment,
          suggestedTerm: replacementFragment,
          reason: rule.reason,
          source: 'ICH M11 Controlled Terminology',
          terminologyCode: rule.terminologyCode,
        });
      }
    }
  }

  return { text: next, changes, suggestions };
}

/** Deterministic controlled terminology suggestions for narrative text. */
export function getControlledTerminologySuggestions(text: string): TerminologySuggestion[] {
  const suggestions: TerminologySuggestion[] = [];
  const lower = text.toLowerCase();

  if (/\bsubjects?\b/.test(lower)) {
    suggestions.push({
      foundTerm: 'subject(s)',
      suggestedTerm: 'participant(s)',
      reason: 'ICH M11 Controlled Terminology prefers participant over subject',
      source: 'ICH M11 Controlled Terminology',
    });
  }

  if (/\binvestigational products?\b/.test(lower)) {
    suggestions.push({
      foundTerm: 'investigational product(s)',
      suggestedTerm: 'investigational trial intervention(s)',
      reason: 'Harmonize legacy investigational product wording to M11 terminology',
      source: 'ICH M11 Controlled Terminology',
    });
  }

  const phaseMatch = lower.match(/\bphase\s+(i{1,3}|iv|1|2|3|4)\b/i);
  if (phaseMatch) {
    const trialPhaseList = getM11Codelists().find((list) => list.name === 'Trial Phase');
    suggestions.push({
      foundTerm: phaseMatch[0],
      suggestedTerm:
        trialPhaseList?.terms.find((term) =>
          term.ichPreferredTerm.toLowerCase().includes(phaseMatch[1].toLowerCase()),
        )?.ichPreferredTerm ?? phaseMatch[0],
      reason: 'Bind structured Trial Phase field to ICH M11 Controlled Terminology codelist',
      source: 'ICH M11 Controlled Terminology',
      terminologyCode: trialPhaseList?.id,
    });
  }

  return suggestions;
}

function removeTemplatePlaceholders(text: string): { text: string; changes: ValidationChange[] } {
  const changes: ValidationChange[] = [];
  let next = text;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(PLACEHOLDER_PATTERN.source, PLACEHOLDER_PATTERN.flags);
  while ((match = pattern.exec(next)) !== null) {
    const originalFragment = match[0];
    const startIndex = match.index;
    next = `${next.slice(0, startIndex)}${next.slice(startIndex + originalFragment.length)}`;
    pattern.lastIndex = startIndex;
    changes.push({
      id: nextChangeId('placeholder-removal'),
      type: 'structural',
      originalText: originalFragment,
      replacementText: '',
      reason: 'Remove template instruction placeholder text',
      startIndex,
      endIndex: startIndex + originalFragment.length,
      severity: 'required',
    });
  }
  return { text: next.trim(), changes };
}

function buildStructuralFindings(
  draft: GeneratedSectionDraft,
  spec: IchM11SectionSpec | undefined,
  studyModel?: StudyModel | null,
): { findings: SectionValidationFinding[]; structuralSuggestions: StructuralSuggestion[] } {
  const validation = validateGeneratedSectionDraft(draft);
  const findings: SectionValidationFinding[] = validation.messages
    .filter((message) => !isLegacyTerminologyPendingMessage(message))
    .map((message) => ({
    code: 'm11_validation',
    severity:
      validation.validationStatus === 'failed'
        ? ('error' as const)
        : validation.validationStatus === 'warnings'
          ? ('warning' as const)
          : ('info' as const),
    message,
  }));

  const structuralSuggestions: StructuralSuggestion[] = findings.map((finding) => ({
    code: finding.code,
    message: finding.message,
    severity: finding.severity === 'error' ? 'required' : finding.severity,
  }));

  if (spec?.conformance === 'required' && !draft.generatedText.trim()) {
    findings.push({
      code: 'required_content',
      severity: 'error',
      message: 'Required M11 section is empty after validation.',
    });
    structuralSuggestions.push({
      code: 'required_content',
      message: 'Required M11 section is empty after validation.',
      severity: 'required',
    });
  }

  if (spec?.sectionType === 'template-instruction') {
    findings.push({
      code: 'template_instruction',
      severity: 'warning',
      message: 'Section maps to M11 template instruction node — author narrative content instead of template boilerplate.',
    });
  }

  if (studyModel && spec?.conformance === 'required' && draft.generatedText.trim().length < 80) {
    findings.push({
      code: 'thin_content',
      severity: 'warning',
      message:
        'Section content appears thin for a required M11 section. Add detail or confirm imported source coverage.',
    });
  }

  return { findings, structuralSuggestions };
}

export type TrackChangeSegmentKind = 'unchanged' | 'deletion' | 'addition' | 'terminology';

export interface TrackChangeSegment {
  kind: TrackChangeSegmentKind;
  text: string;
  replacementText?: string;
  change?: ValidationChange;
  segmentId: string;
}

export interface SideBySidePanelSegment {
  kind: TrackChangeSegmentKind | 'empty';
  text: string;
  change?: ValidationChange;
  segmentId: string;
}

export interface ValidationChangeSummary {
  total: number;
  byType: Record<string, number>;
  label: string;
}

export type ControlledTerminologyStatusLabel = 'Applied' | 'No conflicts' | 'Source unavailable';

const LEGACY_TERMINOLOGY_PENDING =
  'Controlled terminology validation available for structured fields; narrative validation pending.';

export function isLegacyTerminologyPendingMessage(message: string): boolean {
  return message.includes('narrative validation pending');
}

export function resolveControlledTerminologyStatus(
  changes: ValidationChange[] = [],
  controlledTerminologyEnabled = true,
): ControlledTerminologyStatusLabel {
  if (!controlledTerminologyEnabled) {
    return 'Source unavailable';
  }
  if (changes.some((change) => change.type === 'terminology')) {
    return 'Applied';
  }
  return 'No conflicts';
}

export function resolveControlledTerminologyMessage(
  changes: ValidationChange[] = [],
  controlledTerminologyEnabled = true,
): string {
  const status = resolveControlledTerminologyStatus(changes, controlledTerminologyEnabled);
  switch (status) {
    case 'Applied':
      return 'Controlled terminology checks applied where matching terms were found.';
    case 'No conflicts':
      return 'No controlled terminology conflicts detected.';
    default:
      return 'Controlled terminology source unavailable.';
  }
}

export function resolveM11StructureStatus(findings: SectionValidationFinding[] = []): 'Checked' | 'Findings found' {
  const structuralFindings = findings.filter(
    (finding) =>
      finding.code !== 'controlled_terminology' &&
      finding.code !== 'technical_spec_context' &&
      !isLegacyTerminologyPendingMessage(finding.message),
  );
  return structuralFindings.some((finding) => finding.severity === 'error' || finding.severity === 'warning')
    ? 'Findings found'
    : 'Checked';
}

export function buildValidationReviewCompactSummary(
  changes: ValidationChange[] = [],
  findings: SectionValidationFinding[] = [],
): string {
  const relevantFindings = findings.filter(
    (finding) =>
      finding.code !== 'controlled_terminology' &&
      !isLegacyTerminologyPendingMessage(finding.message),
  );
  const changeCount = changes.length;
  const warningCount = relevantFindings.filter((finding) => finding.severity === 'warning').length;
  const errorCount = relevantFindings.filter((finding) => finding.severity === 'error').length;
  const parts: string[] = [];
  if (changeCount > 0) {
    parts.push(`${changeCount} proposed change${changeCount === 1 ? '' : 's'}`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`);
  }
  if (errorCount > 0) {
    parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No proposed changes';
}

export function formatValidationProviderLabel(
  provider?: string,
  model?: string,
): string {
  if (!provider || provider === 'local-deterministic') {
    return 'local-deterministic';
  }
  if (provider === 'openai') {
    return model ? `OpenAI/${model}` : 'OpenAI';
  }
  if (provider === 'azure-openai') {
    return model ? `Azure OpenAI/${model}` : 'Azure OpenAI';
  }
  return model ? `${provider}/${model}` : provider;
}

export function formatValidationChangeType(type: ValidationChangeType, severity?: ValidationChangeSeverity): string {
  if (severity === 'required') {
    return 'required';
  }
  switch (type) {
    case 'terminology':
      return 'terminology';
    case 'structural':
      return 'structure';
    case 'formatting':
      return 'formatting';
    case 'replacement':
      return 'grammar';
    case 'addition':
    case 'deletion':
      return type;
    default:
      return type;
  }
}

export function summarizeValidationChanges(changes: ValidationChange[] = []): ValidationChangeSummary {
  const byType: Record<string, number> = {};
  for (const change of changes) {
    const key = formatValidationChangeType(change.type, change.severity);
    byType[key] = (byType[key] ?? 0) + 1;
  }
  const parts = Object.entries(byType).map(([type, count]) => `${count} ${type}`);
  const total = changes.length;
  const label =
    total === 0
      ? 'No proposed changes'
      : `${total} proposed change${total === 1 ? '' : 's'}${parts.length > 0 ? `: ${parts.join(', ')}` : ''}`;
  return { total, byType, label };
}

export function formatValidationChangeSource(type: ValidationChangeType): string {
  switch (type) {
    case 'terminology':
      return 'Controlled Terminology';
    case 'structural':
      return 'ICH M11 Structure';
    case 'formatting':
      return 'Formatting';
    case 'replacement':
      return 'Grammar';
    case 'addition':
    case 'deletion':
      return 'Required Section Content';
    default:
      return 'Terminology Harmonization';
  }
}

export function formatValidationChangeTooltip(change?: ValidationChange): string {
  if (!change) {
    return 'Text changed during validation.';
  }
  const typeLabel = formatValidationChangeType(change.type, change.severity);
  const sourceLabel = formatValidationChangeSource(change.type);
  const lines = [
    `Change type: ${typeLabel}`,
    `Reason: ${change.reason || 'Validation adjustment'}`,
    `Source: ${sourceLabel}`,
  ];
  if (change.originalText) {
    lines.push(`Original: ${change.originalText}`);
  }
  if (change.replacementText) {
    lines.push(`Replacement: ${change.replacementText}`);
  }
  if (change.terminologyCode) {
    lines.push(`Controlled terminology: ${change.terminologyCode}`);
  }
  if (change.severity) {
    lines.push(`Severity: ${change.severity}`);
  }
  return lines.join('\n');
}

function findChangeForSegment(
  segment: { kind: TrackChangeSegmentKind; text: string; replacementText?: string },
  changes: ValidationChange[],
  usedChangeIds: Set<string>,
): ValidationChange | undefined {
  const trimmed = segment.text.trim();
  if (!trimmed || segment.kind === 'unchanged') {
    return undefined;
  }

  const directMatch = changes.find((change) => {
    if (usedChangeIds.has(change.id)) {
      return false;
    }
    if (segment.kind === 'deletion' || (segment.kind === 'terminology' && change.originalText)) {
      return change.originalText?.trim() === trimmed || change.originalText?.includes(trimmed);
    }
    if (segment.kind === 'addition' || segment.kind === 'terminology') {
      return change.replacementText?.trim() === trimmed || change.replacementText?.includes(trimmed);
    }
    return false;
  });
  if (directMatch) {
    usedChangeIds.add(directMatch.id);
    return directMatch;
  }

  const fuzzyMatch = changes.find((change) => {
    if (usedChangeIds.has(change.id)) {
      return false;
    }
    return (
      (change.originalText && trimmed.includes(change.originalText.trim())) ||
      (change.replacementText && trimmed.includes(change.replacementText.trim()))
    );
  });
  if (fuzzyMatch) {
    usedChangeIds.add(fuzzyMatch.id);
    return fuzzyMatch;
  }

  return undefined;
}

export function enrichTrackChangeSegments(
  originalText: string,
  validatedText: string,
  changes: ValidationChange[] = [],
): TrackChangeSegment[] {
  const base = buildTrackChangeSegments(originalText, validatedText, changes);
  const usedChangeIds = new Set<string>();
  return base.map((segment, index) => ({
    ...segment,
    segmentId: `segment-${index}`,
    change: findChangeForSegment(segment, changes, usedChangeIds),
  }));
}

export function buildSideBySidePanels(
  originalText: string,
  validatedText: string,
  changes: ValidationChange[] = [],
): { left: SideBySidePanelSegment[]; right: SideBySidePanelSegment[]; summary: ValidationChangeSummary } {
  const segments = enrichTrackChangeSegments(originalText, validatedText, changes);
  const left: SideBySidePanelSegment[] = [];
  const right: SideBySidePanelSegment[] = [];

  for (const segment of segments) {
    if (segment.kind === 'unchanged') {
      left.push({ kind: 'unchanged', text: segment.text, segmentId: `${segment.segmentId}-left` });
      right.push({ kind: 'unchanged', text: segment.text, segmentId: `${segment.segmentId}-right` });
      continue;
    }

    if (segment.kind === 'deletion' || (segment.kind === 'terminology' && segment.change?.originalText)) {
      left.push({
        kind: segment.kind,
        text: segment.text,
        change: segment.change,
        segmentId: `${segment.segmentId}-left`,
      });
      right.push({ kind: 'empty', text: '', segmentId: `${segment.segmentId}-right-spacer` });
      continue;
    }

    right.push({
      kind: segment.kind,
      text: segment.text,
      change: segment.change,
      segmentId: `${segment.segmentId}-right`,
    });
    left.push({ kind: 'empty', text: '', segmentId: `${segment.segmentId}-left-spacer` });
  }

  return { left, right, summary: summarizeValidationChanges(changes) };
}

export function buildTrackChangeSegments(
  originalText: string,
  validatedText: string,
  changes: ValidationChange[] = [],
): Array<{
  kind: TrackChangeSegmentKind;
  text: string;
  replacementText?: string;
}> {
  if (originalText === validatedText) {
    return [{ kind: 'unchanged', text: originalText }];
  }

  const terminologyRanges = new Map<string, ValidationChange>();
  for (const change of changes) {
    if (change.type === 'terminology' && change.originalText && change.startIndex !== undefined) {
      terminologyRanges.set(`${change.startIndex}:${change.endIndex}`, change);
    }
  }

  const tokens = tokenizeWithSpaces(originalText);
  const validatedTokens = tokenizeWithSpaces(validatedText);
  const lcs = longestCommonSubsequence(tokens, validatedTokens);
  const segments: Array<{
    kind: 'unchanged' | 'deletion' | 'addition' | 'terminology';
    text: string;
    replacementText?: string;
  }> = [];

  let originalIndex = 0;
  let validatedIndex = 0;
  let lcsIndex = 0;

  while (originalIndex < tokens.length || validatedIndex < validatedTokens.length) {
    if (lcsIndex < lcs.length && tokens[originalIndex] === lcs[lcsIndex]) {
      segments.push({ kind: 'unchanged', text: tokens[originalIndex] });
      originalIndex += 1;
      validatedIndex += 1;
      lcsIndex += 1;
      continue;
    }

    if (validatedIndex < validatedTokens.length && (lcsIndex >= lcs.length || tokens[originalIndex] !== lcs[lcsIndex])) {
      const addition = validatedTokens[validatedIndex];
      const matchedTerminology = changes.find(
        (change) => change.replacementText === addition.trim() || change.replacementText?.includes(addition.trim()),
      );
      segments.push({
        kind: matchedTerminology ? 'terminology' : 'addition',
        text: addition,
        replacementText: matchedTerminology?.originalText,
      });
      validatedIndex += 1;
      continue;
    }

    if (originalIndex < tokens.length) {
      const deletion = tokens[originalIndex];
      const matchedTerminology = changes.find((change) => change.originalText === deletion.trim());
      segments.push({
        kind: matchedTerminology ? 'terminology' : 'deletion',
        text: deletion,
        replacementText: matchedTerminology?.replacementText,
      });
      originalIndex += 1;
    }
  }

  if (segments.length === 0) {
    return [
      { kind: 'unchanged', text: originalText },
      { kind: 'addition', text: validatedText.slice(originalText.length) },
    ];
  }

  return segments;
}

function tokenizeWithSpaces(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

function longestCommonSubsequence(left: string[], right: string[]): string[] {
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  const result: string[] = [];
  let i = left.length;
  let j = right.length;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      result.unshift(left[i - 1]);
      i -= 1;
      j -= 1;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return result;
}

export function evaluateValidation(input: ValidationAgentInput): ValidationAgentOutput {
  changeCounter = 0;
  const originalText = input.importedText.trim();

  if (!originalText) {
    return {
      originalText: input.importedText,
      validatedText: input.importedText,
      changes: [],
      findings: [
        {
          code: 'empty_text',
          severity: 'error',
          message: 'Section has no imported text to validate.',
        },
      ],
      terminologySuggestions: [],
      structuralSuggestions: [],
      validationSummary: {
        changeCount: 0,
        findingCount: 1,
        terminologyCount: 0,
        structuralCount: 0,
        status: 'skipped',
      },
    };
  }

  const spec = input.m11TemplateSection ?? getIchM11TemplateSpecById(input.sectionId);
  const techContext = input.m11TechnicalSpecificationContext ?? ICH_M11_TECHNICAL_SPEC_SECTION_SPECS;
  const terminologySuggestions = input.controlledTerminology === false ? [] : getControlledTerminologySuggestions(originalText);

  let validatedText = originalText;
  const allChanges: ValidationChange[] = [];

  for (const ruleSet of [TERMINOLOGY_EXPANSIONS, HARMONIZATION_RULES, FORMATTING_RULES]) {
    const applied = applyTransformRules(validatedText, ruleSet);
    validatedText = applied.text;
    allChanges.push(...applied.changes);
  }

  const placeholderCleanup = removeTemplatePlaceholders(validatedText);
  validatedText = placeholderCleanup.text;
  allChanges.push(...placeholderCleanup.changes);

  const provisionalDraft: GeneratedSectionDraft = {
    sectionId: input.sectionId,
    title: input.sectionTitle,
    generatedText: validatedText,
    sourceUploadId: '',
    sourceExtractionId: '',
    knowledgeModelId: '',
    matchedSourceCandidateIds: [],
    extractionStatus: 'real-docx-parsed',
    generationStatus: 'generated',
    generationProvider: 'local-deterministic',
    provenance: {
      generationProvider: 'local-deterministic',
      generationModel: 'validation-agent-v1',
      generationTimestamp: new Date().toISOString(),
      generationPromptVersion: 'validation-v1',
      sourceUploadId: '',
      knowledgeModelId: '',
      sourceCandidateIds: [],
      confidence: 1,
      generationNotes: [],
      knowledgeElementsUsed: [],
      draftVersion: 1,
    },
    draftVersion: 1,
    state: 'validationPending',
    stateChangedAt: new Date().toISOString(),
    stateChangedBy: 'Validation Agent',
    stateHistory: [],
    generatedAt: new Date().toISOString(),
    validationStatus: 'not-run',
    validationMessages: [],
    validationFindings: [],
  };

  const { findings, structuralSuggestions } = buildStructuralFindings(provisionalDraft, spec, input.studyModel);

  const terminologyEnabled = input.controlledTerminology !== false;
  findings.push({
    code: 'controlled_terminology',
    severity: 'info',
    message: resolveControlledTerminologyMessage(allChanges, terminologyEnabled),
  });

  if (techContext.some((entry) => entry.id === input.sectionId)) {
    findings.push({
      code: 'technical_spec_context',
      severity: 'info',
      message: 'Section referenced in ICH M11 Technical Specification abbreviated index.',
    });
  }

  const messages = findings.map((finding) => finding.message);
  const hasError = findings.some((finding) => finding.severity === 'error');

  return {
    originalText,
    validatedText,
    changes: allChanges,
    findings,
    terminologySuggestions: [
      ...terminologySuggestions,
      ...allChanges
        .filter((change) => change.type === 'terminology' && change.originalText && change.replacementText)
        .map((change) => ({
          foundTerm: change.originalText!,
          suggestedTerm: change.replacementText!,
          reason: change.reason,
          source: 'ICH M11 Controlled Terminology' as const,
          terminologyCode: change.terminologyCode,
        })),
    ],
    structuralSuggestions,
    validationSummary: {
      changeCount: allChanges.length,
      findingCount: findings.length,
      terminologyCount: allChanges.filter((change) => change.type === 'terminology').length,
      structuralCount: structuralSuggestions.length,
      status: hasError ? 'failed' : 'proposed',
    },
  };
}

export function evaluateValidationFromDraft(
  draft: GeneratedSectionDraft,
  trigger: ValidationAgentTrigger,
  studyModel?: StudyModel | null,
): ValidationAgentOutput {
  const baseText = (draft.sourceText ?? draft.generatedText).trim();
  return evaluateValidation({
    sectionId: draft.sectionId,
    sectionTitle: draft.title,
    importedText: baseText,
    m11TemplateSection: getIchM11TemplateSpecById(draft.sectionId),
    controlledTerminology: true,
    studyModel,
    trigger,
  });
}
