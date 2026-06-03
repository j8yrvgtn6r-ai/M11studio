import generatedAssessmentsFixture from './fixtures/generatedSchedule/assessments.json';
import generatedCellsFixture from './fixtures/generatedSchedule/cells.json';
import generatedMetadataFixture from './fixtures/generatedSchedule/metadata.json';
import generatedVisitsFixture from './fixtures/generatedSchedule/visits.json';

export interface GeneratedScheduleMetadataFixture {
  generatedFromRules: boolean;
  sourceRuleCount: number;
  sourceVisitDefinitionCount: number;
  sourceSoAAssessmentDefinitionCount: number;
}

export const generatedScheduleFixtures = {
  visits: generatedVisitsFixture,
  assessments: generatedAssessmentsFixture,
  cells: generatedCellsFixture,
  metadata: generatedMetadataFixture as GeneratedScheduleMetadataFixture,
} as const;

export type GeneratedScheduleFixtureName = keyof typeof generatedScheduleFixtures;
