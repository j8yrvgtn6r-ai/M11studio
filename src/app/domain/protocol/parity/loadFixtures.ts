import type { AuditEvent, Comment } from '../../../types/protocol';
import { fromFixtureTimestamp } from './fixtureTimestamps';
import assessmentsFixture from './fixtures/assessments.json';
import auditEventsFixture from './fixtures/auditEvents.json';
import commentsFixture from './fixtures/comments.json';
import dependencyEdgesFixture from './fixtures/dependencyEdges.json';
import dependencyNodesFixture from './fixtures/dependencyNodes.json';
import fieldDefinitionsFixture from './fixtures/fieldDefinitions.json';
import protocolSectionsFixture from './fixtures/protocolSections.json';
import soaCellsFixture from './fixtures/soaCells.json';
import validationIssuesFixture from './fixtures/validationIssues.json';
import visitsFixture from './fixtures/visits.json';

type TimestampRecord = { timestamp: string };

function revivifyTimestamps<T extends TimestampRecord>(
  records: T[]
): Array<Omit<T, 'timestamp'> & { timestamp: Date }> {
  return records.map(({ timestamp, ...rest }) => ({
    ...rest,
    timestamp: fromFixtureTimestamp(timestamp),
  })) as Array<Omit<T, 'timestamp'> & { timestamp: Date }>;
}

export const parityFixtures = {
  protocolSections: protocolSectionsFixture,
  fieldDefinitions: fieldDefinitionsFixture,
  visits: visitsFixture,
  assessments: assessmentsFixture,
  soaCells: soaCellsFixture,
  dependencyNodes: dependencyNodesFixture,
  dependencyEdges: dependencyEdgesFixture,
  validationIssues: validationIssuesFixture,
  comments: revivifyTimestamps(commentsFixture as Comment[] & TimestampRecord[]),
  auditEvents: revivifyTimestamps(auditEventsFixture as AuditEvent[] & TimestampRecord[]),
} as const;

export type ParityFixtureName = keyof typeof parityFixtures;
