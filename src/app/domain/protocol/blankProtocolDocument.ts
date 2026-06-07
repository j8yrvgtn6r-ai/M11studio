import type { ProtocolDocument, SectionNode } from './types';
import { mergeProtocolSectionsWithIchM11 } from './ichM11';
import { syncTitlePageSectionStatus } from './authoring/titlePageAuthoring';
import { migrateTitlePageElements } from './authoring/titlePageMigration';
import { selectFieldDefinitions } from './selectors/toFieldDefinitions';
import seedProtocol from './seed/PROTO-XYZ-301.json';

function resetSectionTree(sections: SectionNode[]): void {
  for (const section of sections) {
    section.status = 'requiredMissing';
    section.validationCount = 0;
    section.commentCount = undefined;
    if (section.children?.length) {
      resetSectionTree(section.children);
    }
  }
}

function clearSoAScheduleSeedData(document: ProtocolDocument): void {
  document.title = '';
  document.visitSchedule = {
    anchors: [],
    visitDefinitions: [],
  };
  document.soaAssessmentDefinitions = [];
  document.assessmentScheduleRules = [];
  document.schedule = {
    visits: [],
    assessments: [],
    cells: [],
  };
  document.clinicalDesign = {
    ...document.clinicalDesign,
    assessments: [],
    studyArms: [],
  };
  document.relationships = (document.relationships ?? []).filter((relationship) => {
    const referencesAssessment = /assess-\d+/.test(relationship.sourceId) || /assess-\d+/.test(relationship.targetId);
    const referencesArm = relationship.sourceId === 'arm-1' || relationship.targetId === 'arm-1';
    return !referencesAssessment && !referencesArm;
  });
  document.metadata = {
    ...document.metadata,
    lifecycleStatus: undefined,
    authoringMode: undefined,
  };
}

/** Builds an empty ICH M11 workspace — structure only, no demo field values. */
export function createBlankProtocolDocument(): ProtocolDocument {
  const document = structuredClone(seedProtocol as ProtocolDocument);
  document.id = '';
  document.metadata = {
    ...document.metadata,
    updatedAt: new Date().toISOString(),
    defaultUser: 'Current user',
  };
  document.sections = mergeProtocolSectionsWithIchM11(document.sections, document);
  migrateTitlePageElements(document);
  resetSectionTree(document.sections);
  document.elements = document.elements.map((element) => {
    const next = { ...element };
    delete next.value;
    return next;
  });
  document.validationIssues = [];
  document.collaboration = {
    ...document.collaboration,
    comments: [],
    auditEvents: [],
  };
  clearSoAScheduleSeedData(document);
  syncTitlePageSectionStatus(document, selectFieldDefinitions(document));
  return document;
}
