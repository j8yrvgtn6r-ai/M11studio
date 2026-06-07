import assert from 'node:assert/strict';

import {
  allowsMarkNotApplicable,
  getEditorPlaceholderText,
  getGenerationGuidancePayload,
  getM11TemplateGuidanceCatalog,
  getNotApplicableInsertText,
  getSectionGuidance,
  guidanceContainsInsertionPrompt,
  isGuidanceExcludedSection,
  listMajorSectionGuidanceIds,
  NOT_APPLICABLE_SECTION_TEXT,
  NON_PERSISTED_GUIDANCE_MARKERS,
  shouldShowHeadingOnlyAuthoring,
  shouldSkipRequiredMissingForEmptySection,
} from '../src/app/domain/m11-template-guidance';
import { runM11TemplateGuidanceLintRules } from '../src/app/domain/m11-template-guidance';
import { generateFixtureM11Sections } from '../src/app/domain/protocol/import/llm/fixtureGeneration';
import type { M11GenerationInput } from '../src/app/domain/protocol/import/llm/types';
import type { ImportedProtocolSource, ProtocolSourceArtifact } from '../src/app/domain/protocol/import/types';
import type { ProtocolKnowledgeModel } from '../src/app/domain/protocol/import/protocolKnowledgeTypes';

function testGuidanceExistsForMajorSections() {
  const catalog = getM11TemplateGuidanceCatalog();
  assert.ok(catalog.size > 100);
  const major = ['1', '1.1', '2', '2.1', '3', '3.1.1', '4', '4.1', '8', '8.4', '10', '11', '12'];
  for (const sectionId of major) {
    assert.ok(getSectionGuidance(sectionId), `missing guidance for ${sectionId}`);
  }
  assert.ok(listMajorSectionGuidanceIds().length > 80);
}

function testHeadingOnlySectionsDoNotUseGenericPlaceholder() {
  assert.equal(shouldShowHeadingOnlyAuthoring('1'), true);
  assert.equal(shouldShowHeadingOnlyAuthoring('2'), true);
  assert.equal(getEditorPlaceholderText('1'), undefined);
  assert.ok(getEditorPlaceholderText('2.1')?.includes('research question'));
}

function testEmptySectionGuidanceExamples() {
  const purpose = getSectionGuidance('2.1');
  assert.ok(purpose);
  assert.ok(purpose!.guidanceText.some((line) => /research question/i.test(line)));
  assert.ok(purpose!.guidanceText.some((line) => /Investigator/i.test(line)));

  const objective = getSectionGuidance('3.1.1');
  assert.ok(objective);
  assert.ok(objective!.guidanceText.some((line) => /estimand/i.test(line)));
  assert.ok((objective!.tableGuidance?.length ?? 0) > 0);

  const design = getSectionGuidance('4.1');
  assert.ok(design);
  assert.ok(design!.guidanceText.some((line) => /trial design/i.test(line)));

  const safety = getSectionGuidance('8.4');
  assert.ok(safety);
  assert.ok(safety!.insertionPrompts.some((prompt) => /Physical examination/i.test(prompt)));
}

function testSoASectionIsSkipped() {
  assert.equal(isGuidanceExcludedSection('1.3'), true);
  const soa = getSectionGuidance('1.3');
  assert.ok(soa?.excludedFromGuidanceUi);
}

function testStructuredSectionsExcluded() {
  assert.equal(isGuidanceExcludedSection('title'), true);
  assert.equal(isGuidanceExcludedSection('amendment'), true);
}

function testGuidanceTextIsNotPersistedMarker() {
  for (const marker of NON_PERSISTED_GUIDANCE_MARKERS) {
    assert.ok(marker.length > 0);
  }
  const placeholder = getEditorPlaceholderText('2.1') ?? '';
  assert.ok(!NOT_APPLICABLE_SECTION_TEXT.includes(placeholder));
}

function testMarkNotApplicableAllowedWhereConfigured() {
  assert.equal(allowsMarkNotApplicable('3.3.1'), true);
  assert.equal(getNotApplicableInsertText(), NOT_APPLICABLE_SECTION_TEXT);
}

function testValidationSkipsHeadingOnlyRequiredMissing() {
  assert.equal(shouldSkipRequiredMissingForEmptySection('1'), true);
  assert.equal(shouldSkipRequiredMissingForEmptySection('2.1'), false);
  const headingLint = runM11TemplateGuidanceLintRules({
    sectionId: '1',
    sectionTitle: '1 PROTOCOL SUMMARY',
    content: '',
    plainText: '',
  });
  assert.equal(headingLint.some((issue) => issue.category === 'requiredContent'), false);

  const requiredLint = runM11TemplateGuidanceLintRules({
    sectionId: '2.1',
    sectionTitle: '2.1 Purpose of Trial',
    content: '',
    plainText: '',
  });
  assert.equal(requiredLint.some((issue) => issue.category === 'requiredContent'), true);
}

function testPromptPlaceholderLintWarning() {
  const prompt = getSectionGuidance('2.1')!.insertionPrompts[0] ?? 'State the medical/scientific rationale';
  const issues = runM11TemplateGuidanceLintRules({
    sectionId: '2.1',
    sectionTitle: '2.1 Purpose of Trial',
    content: prompt,
    plainText: prompt,
  });
  assert.ok(issues.some((issue) => issue.message.includes('insertion prompt')));
  assert.ok(guidanceContainsInsertionPrompt(prompt, '2.1'));
}

function testGenerationReceivesSectionGuidance() {
  const payload = getGenerationGuidancePayload('2.1');
  assert.ok(payload);
  assert.ok(Array.isArray(payload!.guidanceText));

  const input: M11GenerationInput = {
    artifact: { id: 'artifact-1', filename: 'example.docx', uploadedAt: new Date().toISOString() } as ProtocolSourceArtifact,
    sourceExtraction: {
      uploadId: 'upload-1',
      filename: 'example.docx',
      extractedAt: new Date().toISOString(),
      fullText: 'Example protocol',
      paragraphs: [],
      headings: [],
      sections: [],
      tables: [],
    } as ImportedProtocolSource,
    protocolKnowledgeModel: {
      id: 'knowledge-1',
      confidence: 0.8,
      studyTitle: 'Example Study',
    } as ProtocolKnowledgeModel,
    sectionIds: ['2.1'],
  };

  const drafts = generateFixtureM11Sections(input);
  assert.equal(drafts.length, 1);
  assert.ok(drafts[0]?.provenance.generationNotes?.some((note) => note.includes('Applied section guidance')));
}

function testNoModuleErrors() {
  assert.equal(typeof getM11TemplateGuidanceCatalog, 'function');
}

async function main() {
  testGuidanceExistsForMajorSections();
  testHeadingOnlySectionsDoNotUseGenericPlaceholder();
  testEmptySectionGuidanceExamples();
  testSoASectionIsSkipped();
  testStructuredSectionsExcluded();
  testGuidanceTextIsNotPersistedMarker();
  testMarkNotApplicableAllowedWhereConfigured();
  testValidationSkipsHeadingOnlyRequiredMissing();
  testPromptPlaceholderLintWarning();
  testGenerationReceivesSectionGuidance();
  testNoModuleErrors();
  console.log('test-m11-template-guidance: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
