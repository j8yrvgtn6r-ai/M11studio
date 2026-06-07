import type { ImportedProtocolSource } from '../import/types';
import type { ProtocolKnowledgeModel } from '../import/protocolKnowledgeTypes';
import {
  TITLE_PAGE_FIELD_CATALOG,
  TITLE_PAGE_FIELD_SPECS_BY_ID,
  type TitlePageFieldId,
} from '../authoring/titlePageModel';

export interface TitlePageExtractionMatch {
  fieldId: TitlePageFieldId;
  value: string | string[];
  confidence: number;
  source: 'label' | 'table' | 'header' | 'knowledge-model' | 'fuzzy';
  excerpt?: string;
}

export interface TitlePageExtractionOutput {
  matches: TitlePageExtractionMatch[];
  extractedFieldCount: number;
  titlePageText: string;
  notes: string[];
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function firstRegexMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]?.trim()) {
      return match[1].trim().slice(0, 500);
    }
  }
  return undefined;
}

function buildLabelPatterns(spec: (typeof TITLE_PAGE_FIELD_CATALOG)[number]): RegExp[] {
  const labels = [spec.label, ...spec.aliases, spec.sourceTerm.replace(/[<>[\]]/g, '')];
  return labels.map(
    (label) => new RegExp(`(?:^|\\n|\\|)\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-–—]?\\s*(.+)$`, 'im'),
  );
}

function extractTitlePageRegion(source: ImportedProtocolSource): string {
  const firstHeadingIndex = source.headings[0]?.paragraphIndex ?? source.paragraphs.length;
  const regionParagraphs = source.paragraphs.slice(0, Math.min(firstHeadingIndex, 40));
  const tableText = (source.tables ?? [])
    .slice(0, 3)
    .flatMap((table) => table.rows.flat())
    .join('\n');
  return [regionParagraphs.join('\n'), tableText, source.fullText.slice(0, 4000)].join('\n');
}

function extractFromTables(source: ImportedProtocolSource): TitlePageExtractionMatch[] {
  const matches: TitlePageExtractionMatch[] = [];
  for (const table of source.tables ?? []) {
    for (const row of table.rows) {
      if (row.length < 2) {
        continue;
      }
      const label = normalizeLabel(row[0] ?? '');
      const value = row.slice(1).join(' ').trim();
      if (!value) {
        continue;
      }
      for (const spec of TITLE_PAGE_FIELD_CATALOG) {
        const aliases = [spec.label, ...spec.aliases].map(normalizeLabel);
        if (aliases.some((alias) => label.includes(alias) || alias.includes(label))) {
          matches.push({
            fieldId: spec.id,
            value: spec.repeatable ? [value] : value,
            confidence: 0.82,
            source: 'table',
            excerpt: `${row[0]}: ${value}`,
          });
        }
      }
    }
  }
  return matches;
}

function extractFromKnowledgeModel(knowledge: ProtocolKnowledgeModel | undefined): TitlePageExtractionMatch[] {
  if (!knowledge) {
    return [];
  }
  const mapping: Array<[TitlePageFieldId, string | undefined]> = [
    ['title_page.full_title', knowledge.studyTitle],
    ['title_page.short_title', knowledge.shortTitle],
    ['title_page.sponsor_protocol_identifier', knowledge.protocolIdentifier],
    ['title_page.version_number', knowledge.version],
    ['title_page.trial_phase', knowledge.phase],
    ['title_page.sponsor_name_and_address', knowledge.sponsor],
  ];
  return mapping
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([fieldId, value]) => ({
      fieldId,
      value: value!.trim(),
      confidence: 0.7,
      source: 'knowledge-model' as const,
    }));
}

function inferOriginalProtocol(text: string): string | undefined {
  if (/\bamendment\b/i.test(text) && !/\boriginal\s+protocol\b/i.test(text)) {
    return 'No';
  }
  if (/\boriginal\s+protocol\b/i.test(text)) {
    return 'Yes';
  }
  return undefined;
}

function inferTrialPhase(text: string): string | undefined {
  return firstRegexMatch(text, [
    /phase\s*[:]\s*(.+)$/im,
    /\b(Early Phase 1|Phase 1\/Phase 2\/Phase 3|Phase 1\/Phase 2|Phase 1\/Phase 3|Phase 2\/Phase 3\/Phase 4|Phase 2\/Phase 3|Phase 1|Phase 2|Phase 3|Phase 4)\b/i,
  ]);
}

export function extractTitlePageFields(
  source: ImportedProtocolSource,
  knowledge?: ProtocolKnowledgeModel,
): TitlePageExtractionOutput {
  const titlePageText = extractTitlePageRegion(source);
  const notes: string[] = [];
  const byField = new Map<TitlePageFieldId, TitlePageExtractionMatch>();

  const pushMatch = (match: TitlePageExtractionMatch) => {
    const existing = byField.get(match.fieldId);
    if (!existing || match.confidence > existing.confidence) {
      byField.set(match.fieldId, match);
    }
  };

  for (const spec of TITLE_PAGE_FIELD_CATALOG) {
    const labeled = firstRegexMatch(titlePageText, buildLabelPatterns(spec));
    if (labeled) {
      pushMatch({
        fieldId: spec.id,
        value: spec.repeatable ? [labeled] : labeled,
        confidence: 0.88,
        source: 'label',
        excerpt: labeled,
      });
    }
  }

  for (const match of extractFromTables(source)) {
    pushMatch(match);
  }

  for (const match of extractFromKnowledgeModel(knowledge)) {
    pushMatch(match);
  }

  const original = inferOriginalProtocol(titlePageText);
  if (original) {
    pushMatch({
      fieldId: 'title_page.original_protocol_indicator',
      value: original,
      confidence: 0.6,
      source: 'fuzzy',
    });
  }

  const phase = inferTrialPhase(titlePageText);
  if (phase && !byField.has('title_page.trial_phase')) {
    pushMatch({
      fieldId: 'title_page.trial_phase',
      value: phase,
      confidence: 0.65,
      source: 'fuzzy',
    });
  }

  const acronym = firstRegexMatch(titlePageText, [/trial\s+acronym\s*[:]\s*(.+)$/im, /acronym\s*[:]\s*(.+)$/im]);
  if (acronym) {
    pushMatch({
      fieldId: 'title_page.trial_acronym',
      value: acronym,
      confidence: 0.75,
      source: 'label',
    });
  }

  const nct = titlePageText.match(/\b(NCT\d{8})\b/i)?.[1];
  if (nct) {
    pushMatch({
      fieldId: 'title_page.regulatory_or_clinical_trial_identifiers',
      value: [nct],
      confidence: 0.9,
      source: 'fuzzy',
    });
  }

  if (byField.size === 0) {
    notes.push('No title page fields matched from source document.');
  } else {
    notes.push(`Matched ${byField.size} title page field(s) using M11 aliases and fuzzy label matching.`);
  }

  const matches = [...byField.values()].filter((match) => TITLE_PAGE_FIELD_SPECS_BY_ID[match.fieldId]);
  return {
    matches,
    extractedFieldCount: matches.length,
    titlePageText,
    notes,
  };
}

export function titlePageExtractionToValues(
  output: TitlePageExtractionOutput,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const match of output.matches) {
    values[match.fieldId] = match.value;
  }
  return values;
}
