import { buildStudyModelFromSources } from '../src/app/domain/study-model/studyModelBuilder';
import { buildFixtureProtocolUnderstanding } from '../src/app/domain/protocol/import/llm/fixtureUnderstanding';
import { UNDERSTANDING_SLICE_DEFINITIONS } from '../src/app/domain/protocol/import/llm/understandingSlices';
import type { ProtocolKnowledgeModel } from '../src/app/domain/protocol/import/protocolKnowledgeTypes';
import type { ImportedProtocolSource } from '../src/app/domain/protocol/import/types';

const mockSource: ImportedProtocolSource = {
  uploadId: 'test',
  filename: 'minimal.docx',
  extractedAt: new Date().toISOString(),
  fullText: 'Study Title: Test Study\nPrimary Objective: Assess safety\nTrial Design: Parallel\nPopulation: Adults\nIntervention: Drug X\nAssessments: Labs\nStatistics: Sample size 100',
  paragraphs: [{ id: 'p1', text: 'Study Title: Test Study', order: 0 }],
  headings: [{ id: 'h1', text: 'Synopsis', level: 1, order: 0 }],
  sections: [
    {
      id: 's1',
      headingText: 'Synopsis',
      text: 'Study Title: Test Study. Primary Objective: Assess safety.',
      order: 0,
      paragraphIds: ['p1'],
    },
  ],
  tables: [],
  extractionWarnings: [],
};

function normalizeSliceOutput(
  raw: Partial<ProtocolKnowledgeModel>,
  outputFields: (keyof ProtocolKnowledgeModel)[],
): Partial<ProtocolKnowledgeModel> {
  const partial: Partial<ProtocolKnowledgeModel> = {};
  for (const field of outputFields) {
    const value = raw[field];
    if (value !== undefined) {
      partial[field] = value as never;
    }
  }
  return partial;
}

function mergePartialKnowledge(
  base: Partial<ProtocolKnowledgeModel>,
  partial: Partial<ProtocolKnowledgeModel>,
): Partial<ProtocolKnowledgeModel> {
  const merged: Partial<ProtocolKnowledgeModel> = { ...base };
  for (const [key, value] of Object.entries(partial) as Array<[keyof ProtocolKnowledgeModel, unknown]>) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const existing = (merged[key] as unknown[] | undefined) ?? [];
      merged[key] = [...new Set([...(existing as unknown[]), ...value])] as never;
      continue;
    }
    if (typeof value === 'string' && value.trim().length === 0) continue;
    merged[key] = value as never;
  }
  return merged;
}

let merged: Partial<ProtocolKnowledgeModel> = {
  id: 'knowledge-test',
  sourceUploadId: 'test',
  extractedAt: new Date().toISOString(),
  knowledgeProvider: 'fixture',
  understandingModel: 'fixture',
  understandingPromptVersion: '1',
  confidence: 0,
  extractionNotes: [],
  sourceReferences: [],
  primaryObjectives: [],
  secondaryObjectives: [],
  exploratoryObjectives: [],
  estimands: [],
  arms: [],
  armDefinitions: [],
  interventions: [],
  visits: [],
  assessments: [],
  safetyMonitoring: [],
  safetyAssessments: [],
  efficacyAssessments: [],
};

const full = buildFixtureProtocolUnderstanding({
  sourceExtraction: mockSource,
  m11TemplateSections: [],
  m11TechnicalSpecification: [],
  artifact: {
    id: 'test',
    filename: 'minimal.docx',
    uploadedAt: new Date().toISOString(),
    fileSize: 1,
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sourceType: 'user-uploaded-protocol',
    status: 'uploaded',
    storagePath: '',
  },
});

for (const slice of UNDERSTANDING_SLICE_DEFINITIONS) {
  const partial = normalizeSliceOutput(full, slice.outputFields);
  merged = mergePartialKnowledge(merged, partial);
  try {
    buildStudyModelFromSources({
      sourceUploadId: 'test',
      knowledge: merged as ProtocolKnowledgeModel,
    });
    console.log(`slice ${slice.id}: OK`);
  } catch (error) {
    console.log(`slice ${slice.id}: FAIL ${error instanceof Error ? error.message : error}`);
    for (const field of slice.outputFields) {
      const value = merged[field];
      if (value !== undefined && value !== null && !Array.isArray(value) && typeof value !== 'string') {
        console.log('  weird field', field, typeof value);
      }
      if (
        ['primaryObjectives', 'arms', 'interventions', 'visits', 'estimands', 'endpoints'].includes(field) &&
        typeof value === 'string'
      ) {
        console.log('  STRING IN ARRAY FIELD', field, value);
      }
    }
    process.exit(1);
  }
}

console.log('All fixture slices OK');
