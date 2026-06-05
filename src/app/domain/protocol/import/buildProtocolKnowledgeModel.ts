import type { ImportedProtocolSource } from './types';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';

const LABEL_PATTERNS: Array<{ field: keyof ProtocolKnowledgeModel; patterns: RegExp[] }> = [
  { field: 'studyTitle', patterns: [/^(?:study\s+)?title\s*[:]\s*(.+)$/im, /^protocol\s+title\s*[:]\s*(.+)$/im] },
  { field: 'shortTitle', patterns: [/short\s+title\s*[:]\s*(.+)$/im, /acronym\s*[:]\s*(.+)$/im] },
  { field: 'sponsor', patterns: [/sponsor\s*[:]\s*(.+)$/im] },
  { field: 'protocolIdentifier', patterns: [/protocol\s+(?:number|id|identifier)\s*[:]\s*(.+)$/im, /\b(PROTO-[A-Z0-9-]+)\b/i] },
  { field: 'version', patterns: [/protocol\s+version\s*[:]\s*(.+)$/im, /version\s*[:]\s*([\d.]+)/i] },
  { field: 'phase', patterns: [/phase\s*[:]\s*(.+)$/im, /\bphase\s+(I{1,3}|IV|1|2|3|4)\b/i] },
  { field: 'indication', patterns: [/indication\s*[:]\s*(.+)$/im] },
  { field: 'population', patterns: [/population\s*[:]\s*(.+)$/im, /study\s+population\s*[:]\s*(.+)$/im] },
  { field: 'eligibilitySummary', patterns: [/eligibility\s*[:]\s*(.+)$/im] },
  { field: 'statisticalSummary', patterns: [/statistical\s+(?:considerations|analysis|methods)\s*[:]\s*(.+)$/im] },
];

const SECTION_KEYWORDS: Record<string, RegExp> = {
  objectives: /objective/i,
  endpoints: /endpoint/i,
  estimands: /estimand/i,
  arms: /\barm\b|treatment\s+arm/i,
  interventions: /intervention|investigational|study\s+drug/i,
  safetyAssessments: /safety|adverse\s+event/i,
  efficacyAssessments: /efficacy|primary\s+endpoint/i,
};

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      return match[1].trim().slice(0, 500);
    }
  }
  return undefined;
}

function linesFromSections(source: ImportedProtocolSource, keyword: RegExp): string[] {
  const hits: string[] = [];
  for (const section of source.sections) {
    if (keyword.test(section.headingText) || keyword.test(section.text.slice(0, 200))) {
      const line = `${section.headingText}: ${section.text.replace(/\s+/g, ' ').trim().slice(0, 240)}`;
      if (!hits.includes(line)) {
        hits.push(line);
      }
    }
  }
  return hits.slice(0, 8);
}

function inferStudyTitle(source: ImportedProtocolSource): string | undefined {
  const labeled = firstMatch(source.fullText, LABEL_PATTERNS[0].patterns);
  if (labeled) {
    return labeled;
  }
  const firstHeading = source.headings[0]?.text ?? source.sections[0]?.headingText;
  return firstHeading?.trim().slice(0, 300);
}

/** Deterministic knowledge extraction from DOCX source — not LLM-generated. */
export function buildLocalDeterministicKnowledgeModel(
  sourceExtraction: ImportedProtocolSource,
): ProtocolKnowledgeModel {
  const text = sourceExtraction.fullText;
  const notes: string[] = [
    'Knowledge assembled locally from DOCX text using pattern and section heuristics.',
    'This is not an LLM semantic rewrite. Configure an LLM provider later for richer extraction.',
  ];

  if (sourceExtraction.extractionWarnings.length > 0) {
    notes.push(...sourceExtraction.extractionWarnings.map((warning) => `Source: ${warning}`));
  }

  const model: ProtocolKnowledgeModel = {
    id: `knowledge-${sourceExtraction.uploadId}`,
    sourceUploadId: sourceExtraction.uploadId,
    extractedAt: new Date().toISOString(),
    knowledgeProvider: 'local-deterministic',
    confidence: sourceExtraction.sections.length > 1 ? 0.55 : 0.35,
    extractionNotes: notes,
    studyTitle: inferStudyTitle(sourceExtraction),
    objectives: linesFromSections(sourceExtraction, SECTION_KEYWORDS.objectives),
    endpoints: linesFromSections(sourceExtraction, SECTION_KEYWORDS.endpoints),
    estimands: linesFromSections(sourceExtraction, SECTION_KEYWORDS.estimands),
    arms: linesFromSections(sourceExtraction, SECTION_KEYWORDS.arms),
    interventions: linesFromSections(sourceExtraction, SECTION_KEYWORDS.interventions),
    safetyAssessments: linesFromSections(sourceExtraction, SECTION_KEYWORDS.safetyAssessments),
    efficacyAssessments: linesFromSections(sourceExtraction, SECTION_KEYWORDS.efficacyAssessments),
  };

  for (const { field, patterns } of LABEL_PATTERNS) {
    if (field === 'studyTitle') {
      continue;
    }
    const value = firstMatch(text, patterns);
    if (value && typeof model[field] === 'undefined') {
      (model as Record<string, unknown>)[field] = value;
    }
  }

  if (!model.protocolIdentifier) {
    const idMatch = /\b([A-Z]{2,}-\d{3,}[A-Z0-9-]*)\b/.exec(text);
    if (idMatch) {
      model.protocolIdentifier = idMatch[1];
    }
  }

  if (!model.phase && /\bphase\s+(I{1,3}|IV)\b/i.test(text)) {
    model.phase = text.match(/\bphase\s+(I{1,3}|IV)\b/i)?.[0];
  }

  const populatedScalars = [
    model.studyTitle,
    model.sponsor,
    model.protocolIdentifier,
    model.phase,
    model.indication,
  ].filter(Boolean).length;
  const populatedLists =
    model.objectives.length +
    model.endpoints.length +
    model.arms.length +
    model.interventions.length;

  if (populatedScalars + populatedLists >= 4) {
    model.confidence = Math.min(0.75, model.confidence + 0.15);
  }

  return model;
}

/** Provider boundary — swap implementation when LLM is configured. */
export async function buildProtocolKnowledgeModel(
  sourceExtraction: ImportedProtocolSource,
): Promise<ProtocolKnowledgeModel> {
  return buildLocalDeterministicKnowledgeModel(sourceExtraction);
}
