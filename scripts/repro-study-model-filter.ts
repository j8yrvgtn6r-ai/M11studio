import { buildStudyModelFromSources } from '../src/app/domain/study-model/studyModelBuilder';
import type { ProtocolKnowledgeModel } from '../src/app/domain/protocol/import/protocolKnowledgeTypes';

function testCase(label: string, knowledge: Partial<ProtocolKnowledgeModel>) {
  try {
    buildStudyModelFromSources({
      sourceUploadId: 'x',
      knowledge: {
        id: 'k1',
        sourceUploadId: 'x',
        extractedAt: '',
        knowledgeProvider: 'openai',
        understandingModel: 'gpt',
        understandingPromptVersion: '1',
        confidence: 0.5,
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
        ...knowledge,
      },
    });
    console.log(`${label}: OK`);
  } catch (error) {
    console.log(`${label}: ${error instanceof Error ? error.message : error}`);
  }
}

testCase('arms string', { arms: 'Treatment A vs B' as unknown as string[] });
testCase('primaryObjectives string', { primaryObjectives: 'Reduce symptoms' as unknown as string[] });
testCase('objectives string fallback', { objectives: 'Legacy objective' as unknown as string[] });
testCase('interventions string', { interventions: 'Drug X' as unknown as string[] });
