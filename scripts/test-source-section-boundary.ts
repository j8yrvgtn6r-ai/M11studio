import assert from 'node:assert/strict';

import {
  collectParagraphSectionBoundaries,
  extractBodyTextBetweenParagraphs,
  findNextPeerOrHigherBoundary,
  isAppendixHeading,
  isSuspiciousImportedBody,
  isTableOfContentsEntry,
} from '../src/app/domain/protocol/import/sourceSectionBodyExtractor';
import { detectSourceSections } from '../src/app/domain/protocol/import/sourceSectionDetection';
import { runStructuralMappingEngine } from '../src/app/domain/protocol/import/structuralMappingEngine';
import type { ExtractedHeading, ExtractedParagraph } from '../src/app/domain/protocol/import/types';

function paragraph(index: number, text: string, options: Partial<ExtractedParagraph> = {}): ExtractedParagraph {
  return {
    id: `paragraph-${index}`,
    index,
    text,
    isHeadingStyle: false,
    ...options,
  };
}

function buildFixtureParagraphs(): ExtractedParagraph[] {
  return [
    paragraph(0, 'Table of Contents'),
    paragraph(1, '1 Protocol Summary ........ 3'),
    paragraph(2, '1 Protocol Summary', { isHeadingStyle: true, headingLevel: 1 }),
    paragraph(3, 'This study evaluates overall survival in adults with advanced disease.'),
    paragraph(4, 'The primary objective is to demonstrate superiority versus control.'),
    paragraph(5, '2 Study Objectives', { isHeadingStyle: true, headingLevel: 1 }),
    paragraph(6, 'Primary objective paragraph one.'),
    paragraph(7, '3.1 Primary Endpoints', { isHeadingStyle: true, headingLevel: 2 }),
    paragraph(8, 'Primary endpoint details belong here.'),
    paragraph(9, 'Appendix 4 Protocol Summary Form', { isHeadingStyle: true, headingLevel: 1 }),
    paragraph(10, 'Pr'),
  ];
}

function testHeadingMatchCopiesUntilNextSiblingHeading() {
  const paragraphs = buildFixtureParagraphs();
  const boundaries = collectParagraphSectionBoundaries(paragraphs, [
    {
      id: 'heading-2',
      index: 0,
      text: '1 Protocol Summary',
      level: 1,
      paragraphIndex: 2,
      charStart: 0,
    } satisfies ExtractedHeading,
    {
      id: 'heading-5',
      index: 1,
      text: '2 Study Objectives',
      level: 1,
      paragraphIndex: 5,
      charStart: 0,
    } satisfies ExtractedHeading,
  ]);

  const summaryIndex = boundaries.findIndex((boundary) => boundary.headingText.startsWith('1 Protocol Summary'));
  assert.ok(summaryIndex >= 0);
  const endParagraphIndex = findNextPeerOrHigherBoundary(boundaries, summaryIndex, paragraphs.length);
  assert.equal(endParagraphIndex, 5);
  const body = extractBodyTextBetweenParagraphs(paragraphs, boundaries[summaryIndex].paragraphIndex, endParagraphIndex);
  assert.match(body, /overall survival/);
  assert.match(body, /primary objective is to demonstrate superiority/);
  assert.doesNotMatch(body, /Primary objective paragraph one/);
}

function testChildHeadingsIncludedInParentSection() {
  const paragraphs = buildFixtureParagraphs();
  const boundaries = collectParagraphSectionBoundaries(paragraphs, [
    {
      id: 'heading-5',
      index: 0,
      text: '2 Study Objectives',
      level: 1,
      paragraphIndex: 5,
      charStart: 0,
    } satisfies ExtractedHeading,
    {
      id: 'heading-7',
      index: 1,
      text: '3.1 Primary Endpoints',
      level: 2,
      paragraphIndex: 7,
      charStart: 0,
    } satisfies ExtractedHeading,
  ]);

  const objectivesIndex = boundaries.findIndex((boundary) => boundary.headingText.startsWith('2 Study Objectives'));
  const endParagraphIndex = findNextPeerOrHigherBoundary(boundaries, objectivesIndex, paragraphs.length);
  const body = extractBodyTextBetweenParagraphs(
    paragraphs,
    boundaries[objectivesIndex].paragraphIndex,
    endParagraphIndex,
  );
  assert.match(body, /Primary objective paragraph one/);
  assert.match(body, /Primary endpoint details belong here/);
}

function testTableOfContentsEntriesIgnored() {
  assert.ok(isTableOfContentsEntry('Table of Contents'));
  assert.ok(isTableOfContentsEntry('1 Protocol Summary ........ 3'));
  assert.ok(!isTableOfContentsEntry('1 Protocol Summary'));

  const paragraphs = buildFixtureParagraphs();
  const boundaries = collectParagraphSectionBoundaries(paragraphs, []);
  assert.equal(
    boundaries.some((boundary) => boundary.headingText.includes('........')),
    false,
  );
}

function testAppendixFragmentsNotMappedToProtocolSummary() {
  const paragraphs = buildFixtureParagraphs();
  const source = detectSourceSections('upload-1', 'fixture.docx', paragraphs.map((p) => p.text).join('\n'), paragraphs, [], [], []);
  const mapping = runStructuralMappingEngine(source);
  const summaryMapping = mapping.mappings.find(
    (entry) => entry.mappedM11SectionId === '1' || entry.mappedM11SectionId.startsWith('1.'),
  );
  if (summaryMapping) {
    assert.doesNotMatch(summaryMapping.sourceText, /^Pr$/);
    assert.ok(summaryMapping.importedTextLength >= 50);
  }
  for (const entry of mapping.mappings) {
    assert.notEqual(entry.sourceText.trim(), 'Pr');
  }
  assert.ok(isAppendixHeading('Appendix 4 Protocol Summary Form'));
}

function testEmptyBodySectionsAreSuspicious() {
  assert.ok(isSuspiciousImportedBody('', '1 Protocol Summary'));
  assert.ok(isSuspiciousImportedBody('Short', '1 Protocol Summary'));
  assert.ok(!isSuspiciousImportedBody('A'.repeat(60), '1 Protocol Summary'));
}

function main() {
  testHeadingMatchCopiesUntilNextSiblingHeading();
  testChildHeadingsIncludedInParentSection();
  testTableOfContentsEntriesIgnored();
  testAppendixFragmentsNotMappedToProtocolSummary();
  testEmptyBodySectionsAreSuspicious();
  console.log('Source section boundary tests passed.');
}

main();
