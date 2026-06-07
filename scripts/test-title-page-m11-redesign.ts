import assert from 'node:assert/strict';

import {
  extractTitlePageFields,
  titlePageExtractionToValues,
} from '../src/app/domain/protocol/authoring/titlePageExtractionRules';
import { migrateTitlePageElements, hydrateTitlePageFromValues } from '../src/app/domain/protocol/authoring/titlePageMigration';
import {
  isTitlePageFieldVisible,
  orderedTitlePageFieldDefinitions,
  readTitlePageFieldValues,
  TITLE_PAGE_FIELD_CATALOG,
  TITLE_PAGE_SECTION_ID,
} from '../src/app/domain/protocol/authoring/titlePageModel';
import {
  evaluateTitlePageCompletion,
  isTitlePageFieldValueComplete,
  resolveTitlePageFieldDisplayBadges,
} from '../src/app/domain/protocol/authoring/titlePageAuthoring';
import {
  buildTitlePageValidationOutput,
  validateTitlePageModel,
} from '../src/app/domain/protocol/authoring/titlePageValidationEngine';
import { getFieldDefinitions, updateElementValue } from '../src/app/domain/protocol';
import { getProtocolDocument, resetProtocolStoreToBlank } from '../src/app/domain/protocol/store/protocolStore';
import { selectFieldDefinitions } from '../src/app/domain/protocol/selectors/toFieldDefinitions';
import type { ImportedProtocolSource } from '../src/app/domain/protocol/import/types';

function fillRequiredTitlePageFields() {
  updateElementValue('title_page.full_title', 'A Phase 3 Study of Drug A in Example Disease');
  updateElementValue('title_page.sponsor_protocol_identifier', 'SP-001');
  updateElementValue('title_page.trial_phase', 'Phase 3');
  updateElementValue('title_page.original_protocol_indicator', 'Yes');
}

function testCanonicalSequenceIsPreserved() {
  resetProtocolStoreToBlank();
  migrateTitlePageElements(getProtocolDocument());
  const fields = selectFieldDefinitions(getProtocolDocument()).filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID);
  const ordered = orderedTitlePageFieldDefinitions(fields);
  assert.equal(ordered.length, TITLE_PAGE_FIELD_CATALOG.length);
  assert.deepEqual(
    ordered.map((field) => field.id),
    TITLE_PAGE_FIELD_CATALOG.map((spec) => spec.id),
  );
}

function testMigrationPreservesLegacyValues() {
  resetProtocolStoreToBlank();
  updateElementValue('title_page.full_title', 'Legacy full title');
  updateElementValue('title_page.sponsor_protocol_identifier', 'LEG-001');
  const document = getProtocolDocument();
  migrateTitlePageElements(document);
  const fields = selectFieldDefinitions(document);
  assert.equal(fields.find((field) => field.id === 'title_page.full_title')?.value, 'Legacy full title');
  assert.equal(fields.find((field) => field.id === 'title_page.sponsor_protocol_identifier')?.value, 'LEG-001');
  assert.ok(fields.some((field) => field.id === 'title_page.medical_expert_contact'));
}

function testConditionalVisibilityForOriginalProtocolYes() {
  const values = {
    'title_page.original_protocol_indicator': 'Yes',
  };
  assert.equal(isTitlePageFieldVisible(TITLE_PAGE_FIELD_CATALOG[7], values), false);
  assert.equal(isTitlePageFieldVisible(TITLE_PAGE_FIELD_CATALOG[8], values), false);
  assert.equal(isTitlePageFieldVisible(TITLE_PAGE_FIELD_CATALOG[21], values), false);
}

function testConditionalVisibilityForAmendmentNotGlobal() {
  const values = {
    'title_page.original_protocol_indicator': 'No',
    'title_page.amendment_scope': 'Not Global',
  };
  assert.equal(isTitlePageFieldVisible(TITLE_PAGE_FIELD_CATALOG[7], values), true);
  assert.equal(isTitlePageFieldVisible(TITLE_PAGE_FIELD_CATALOG[21], values), true);
}

function testValidationEngineUsesMetadataNotHardcodedFieldList() {
  resetProtocolStoreToBlank();
  fillRequiredTitlePageFields();
  const fields = getFieldDefinitions().filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID);
  const result = validateTitlePageModel(fields);
  assert.equal(result.status, 'proposed');
  assert.equal(result.missingRequiredFieldIds.length, 0);
}

function testValidationFailsWhenAmendmentFieldsMissing() {
  resetProtocolStoreToBlank();
  fillRequiredTitlePageFields();
  updateElementValue('title_page.original_protocol_indicator', 'No');
  const fields = getFieldDefinitions().filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID);
  const result = validateTitlePageModel(fields);
  assert.equal(result.status, 'failed');
  assert.ok(result.findings.some((finding) => finding.fieldId === 'title_page.amendment_identifier'));
}

function testExtractionAgentMapsLabels() {
  const source: ImportedProtocolSource = {
    uploadId: 'upload-1',
    filename: 'example.docx',
    extractedAt: new Date().toISOString(),
    fullText: [
      'Protocol Title: A Phase 3 Study of Drug A',
      'Protocol Number: ACME-2026-001',
      'Phase: Phase 3',
      'Sponsor: Example Pharma Inc.',
      'NCT12345678',
    ].join('\n'),
    paragraphs: [],
    headings: [{ id: 'h1', text: '1 Introduction', level: 1, paragraphIndex: 5 }],
    sections: [],
    tables: [
      {
        id: 'table-1',
        rows: [
          ['Short Title', 'Drug A Phase 3'],
          ['Version Number', '2.0'],
        ],
      },
    ],
  };

  const output = extractTitlePageFields(source);
  const values = titlePageExtractionToValues(output);
  assert.equal(values['title_page.full_title'], 'A Phase 3 Study of Drug A');
  assert.equal(values['title_page.sponsor_protocol_identifier'], 'ACME-2026-001');
  assert.equal(values['title_page.trial_phase'], 'Phase 3');
  assert.equal(values['title_page.short_title'], 'Drug A Phase 3');
  assert.equal(values['title_page.version_number'], '2.0');
  assert.deepEqual(values['title_page.regulatory_or_clinical_trial_identifiers'], ['NCT12345678']);
}

function testBadgesFollowConformanceNotGrouping() {
  resetProtocolStoreToBlank();
  fillRequiredTitlePageFields();
  const requiredField = getFieldDefinitions().find((field) => field.id === 'title_page.full_title');
  const optionalField = getFieldDefinitions().find((field) => field.id === 'title_page.trial_acronym');
  assert.ok(requiredField);
  assert.ok(optionalField);
  assert.ok(resolveTitlePageFieldDisplayBadges(requiredField!).includes('Required'));
  assert.ok(resolveTitlePageFieldDisplayBadges(optionalField!).includes('Optional'));
}

function testSerializeUsesCanonicalSequence() {
  resetProtocolStoreToBlank();
  fillRequiredTitlePageFields();
  updateElementValue('title_page.trial_acronym', 'DRUGA-301');
  const output = buildTitlePageValidationOutput(getFieldDefinitions().filter((field) => field.sectionId === TITLE_PAGE_SECTION_ID));
  assert.match(output.originalText, /Full Title:/);
  const acronymIndex = output.originalText.indexOf('Trial Acronym:');
  const fullTitleIndex = output.originalText.indexOf('Full Title:');
  assert.ok(fullTitleIndex >= 0 && acronymIndex > fullTitleIndex);
}

function testHydrationFromExtractionValues() {
  resetProtocolStoreToBlank();
  const document = getProtocolDocument();
  hydrateTitlePageFromValues(document, {
    'title_page.full_title': 'Imported title',
    'title_page.sponsor_protocol_identifier': 'IMP-001',
    'title_page.trial_phase': 'Phase 2',
    'title_page.original_protocol_indicator': 'Yes',
  });
  const fields = selectFieldDefinitions(document);
  assert.equal(fields.find((field) => field.id === 'title_page.full_title')?.value, 'Imported title');
  const summary = evaluateTitlePageCompletion(fields);
  assert.equal(summary.allRequiredComplete, true);
  assert.equal(isTitlePageFieldValueComplete('title_page.full_title', 'Imported title'), true);
}

async function main() {
  testCanonicalSequenceIsPreserved();
  testMigrationPreservesLegacyValues();
  testConditionalVisibilityForOriginalProtocolYes();
  testConditionalVisibilityForAmendmentNotGlobal();
  testValidationEngineUsesMetadataNotHardcodedFieldList();
  testValidationFailsWhenAmendmentFieldsMissing();
  testExtractionAgentMapsLabels();
  testBadgesFollowConformanceNotGrouping();
  testSerializeUsesCanonicalSequence();
  testHydrationFromExtractionValues();
  console.log('test-title-page-m11-redesign: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
