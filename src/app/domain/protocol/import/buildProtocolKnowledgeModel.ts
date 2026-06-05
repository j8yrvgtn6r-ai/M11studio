import type { ImportedProtocolSource } from './types';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';
import { runProtocolUnderstanding } from './llm/protocolUnderstandingProvider';
import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import { ICH_M11_TECHNICAL_SPEC_SECTION_SPECS } from '../ichM11/ichM11TechnicalSpecification';
import { UNDERSTANDING_PROMPT_VERSION } from './llm/types';

const LABEL_PATTERNS: Array<{ field: keyof ProtocolKnowledgeModel; patterns: RegExp[] }> = [
  { field: 'studyTitle', patterns: [/^(?:study\s+)?title\s*[:]\s*(.+)$/im, /^protocol\s+title\s*[:]\s*(.+)$/im] },
  { field: 'shortTitle', patterns: [/short\s+title\s*[:]\s*(.+)$/im, /acronym\s*[:]\s*(.+)$/im] },
  { field: 'sponsor', patterns: [/sponsor\s*[:]\s*(.+)$/im] },
  { field: 'protocolIdentifier', patterns: [/protocol\s+(?:number|id|identifier)\s*[:]\s*(.+)$/im, /\b(PROTO-[A-Z0-9-]+)\b/i] },
  { field: 'version', patterns: [/protocol\s+version\s*[:]\s*(.+)$/im, /version\s*[:]\s*([\d.]+)/i] },
  { field: 'phase', patterns: [/phase\s*[:]\s*(.+)$/im, /\bphase\s+(I{1,3}|IV|1|2|3|4)\b/i] },
  { field: 'indication', patterns: [/indication\s*[:]\s*(.+)$/im] },
  { field: 'targetPopulation', patterns: [/population\s*[:]\s*(.+)$/im, /study\s+population\s*[:]\s*(.+)$/im] },
  { field: 'inclusionCriteriaSummary', patterns: [/inclusion\s*[:]\s*(.+)$/im] },
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
  return source.headings[0]?.text ?? source.sections[0]?.headingText;
}

/** Legacy deterministic helper — used by fixture provider fallback paths only. */
export function buildLocalDeterministicKnowledgeModel(
  sourceExtraction: ImportedProtocolSource,
): ProtocolKnowledgeModel {
  const text = sourceExtraction.fullText;
  const notes: string[] = [
    'Legacy deterministic knowledge helper.',
  ];

  const primaryObjectives = linesFromSections(sourceExtraction, SECTION_KEYWORDS.objectives);

  const model: ProtocolKnowledgeModel = {
    id: `knowledge-${sourceExtraction.uploadId}`,
    sourceUploadId: sourceExtraction.uploadId,
    extractedAt: new Date().toISOString(),
    knowledgeProvider: 'local',
    understandingModel: 'local-deterministic-v1',
    understandingPromptVersion: UNDERSTANDING_PROMPT_VERSION,
    confidence: sourceExtraction.sections.length > 1 ? 0.55 : 0.35,
    extractionNotes: notes,
    sourceReferences: sourceExtraction.sections.slice(0, 4).map((section) => ({
      sourceSectionId: section.id,
      label: section.headingText,
      excerpt: section.text.slice(0, 200),
    })),
    studyTitle: inferStudyTitle(sourceExtraction),
    primaryObjectives,
    secondaryObjectives: [],
    exploratoryObjectives: [],
    objectives: primaryObjectives,
    endpoints: linesFromSections(sourceExtraction, SECTION_KEYWORDS.endpoints),
    estimands: linesFromSections(sourceExtraction, SECTION_KEYWORDS.estimands),
    arms: linesFromSections(sourceExtraction, SECTION_KEYWORDS.arms),
    armDefinitions: [],
    interventions: linesFromSections(sourceExtraction, SECTION_KEYWORDS.interventions),
    visits: [],
    assessments: [],
    safetyMonitoring: [],
    safetyAssessments: linesFromSections(sourceExtraction, SECTION_KEYWORDS.safetyAssessments),
    efficacyAssessments: linesFromSections(sourceExtraction, SECTION_KEYWORDS.efficacyAssessments),
  };

  for (const { field, patterns } of LABEL_PATTERNS) {
    if (field === 'studyTitle') continue;
    const value = firstMatch(text, patterns);
    if (value && (model as Record<string, unknown>)[field] === undefined) {
      (model as Record<string, unknown>)[field] = value;
    }
  }

  return model;
}

/** Provider boundary — delegates to configured ProtocolUnderstandingProvider. */
export async function buildProtocolKnowledgeModel(
  sourceExtraction: ImportedProtocolSource,
  artifact?: { id: string; filename: string },
): Promise<ProtocolKnowledgeModel> {
  return runProtocolUnderstanding({
    sourceExtraction,
    m11TemplateSections: ICH_M11_TEMPLATE_SECTION_SPECS,
    m11TechnicalSpecification: ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
    artifact: {
      id: artifact?.id ?? sourceExtraction.uploadId,
      filename: artifact?.filename ?? sourceExtraction.filename,
      uploadedAt: sourceExtraction.extractedAt,
      fileSize: 0,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sourceType: 'user-uploaded-protocol',
      status: 'processed',
      storagePath: '',
    },
  });
}
