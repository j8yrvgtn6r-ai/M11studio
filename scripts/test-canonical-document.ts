import assert from 'node:assert/strict';

import { evaluateStructuralMapping, toStructuralMappingResult } from '../src/app/agents/structuralMappingRules';
import {
  buildCanonicalDocument,
  calculateSectionSimilarity,
  canonicalSectionsToSourceCandidates,
  saveCanonicalDocument,
} from '../src/app/domain/document-ingestion';
import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../src/app/domain/protocol/ichM11/ichM11Template';
import {
  isLikelyHeaderFooterText,
  isTableOfContentsEntry,
} from '../src/app/domain/protocol/import/sourceSectionBodyExtractor';
import { detectSourceSections } from '../src/app/domain/protocol/import/sourceSectionDetection';
import type { ExtractedParagraph } from '../src/app/domain/protocol/import/types';

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
    paragraph(4, '2 Study Objectives', { isHeadingStyle: true, headingLevel: 1 }),
    paragraph(5, 'Primary objective paragraph one.'),
    paragraph(6, '8.4.2 Vital Signs', { isHeadingStyle: true, headingLevel: 3 }),
    paragraph(7, '8.4.2 Vital Signs'),
    paragraph(8, 'Page 1 of 12'),
    paragraph(9, 'Page 1 of 12'),
    paragraph(10, 'Page 2 of 12'),
    paragraph(11, 'Page 2 of 12'),
  ];
}

function testHeadingClassification() {
  const document = buildCanonicalDocument({
    uploadId: 'upload-heading',
    filename: 'fixture.docx',
    paragraphs: buildFixtureParagraphs(),
    headings: [],
    tables: [],
    fullText: buildFixtureParagraphs().map((entry) => entry.text).join('\n'),
  });
  const headings = document.blocks.filter((block) => block.type === 'heading');
  assert.ok(headings.some((block) => block.text.includes('Protocol Summary')));
  assert.ok(headings.some((block) => block.numbering === '8.4.2'));
}

function testTocClassification() {
  const document = buildCanonicalDocument({
    uploadId: 'upload-toc',
    filename: 'fixture.docx',
    paragraphs: buildFixtureParagraphs(),
    headings: [],
    tables: [],
    fullText: buildFixtureParagraphs().map((entry) => entry.text).join('\n'),
  });
  assert.ok(document.blocks.some((block) => block.type === 'toc'));
  assert.ok(isTableOfContentsEntry('1 Protocol Summary ........ 3'));
}

function testHeaderFooterDetection() {
  const document = buildCanonicalDocument({
    uploadId: 'upload-header',
    filename: 'fixture.docx',
    paragraphs: buildFixtureParagraphs(),
    headings: [],
    tables: [],
    fullText: buildFixtureParagraphs().map((entry) => entry.text).join('\n'),
  });
  const footerBlocks = document.blocks.filter((block) => block.type === 'footer' || block.type === 'header');
  assert.ok(footerBlocks.length >= 1);
  assert.ok(isLikelyHeaderFooterText('Page 1 of 12'));
}

function testCanonicalSectionBoundaries() {
  const paragraphs = buildFixtureParagraphs();
  const document = buildCanonicalDocument({
    uploadId: 'upload-boundary',
    filename: 'fixture.docx',
    paragraphs,
    headings: [],
    tables: [],
    fullText: paragraphs.map((entry) => entry.text).join('\n'),
  });
  const summary = document.sections.find((section) => section.title.startsWith('1 Protocol Summary'));
  assert.ok(summary);
  assert.match(summary!.text, /overall survival/);
  assert.doesNotMatch(summary!.text, /Primary objective paragraph one/);
}

function testNumberingNormalization() {
  const document = buildCanonicalDocument({
    uploadId: 'upload-numbering',
    filename: 'fixture.docx',
    paragraphs: buildFixtureParagraphs(),
    headings: [],
    tables: [],
    fullText: buildFixtureParagraphs().map((entry) => entry.text).join('\n'),
  });
  const vitalSigns = document.sections.find((section) => section.numbering === '8.4.2');
  assert.ok(vitalSigns);
  assert.equal(vitalSigns!.headingLevel, 3);
}

function testSimilarityScoring() {
  const paragraphs = buildFixtureParagraphs();
  const document = buildCanonicalDocument({
    uploadId: 'upload-similarity',
    filename: 'fixture.docx',
    paragraphs,
    headings: [],
    tables: [],
    fullText: paragraphs.map((entry) => entry.text).join('\n'),
  });
  const summarySection = document.sections.find((section) => section.numbering === '1');
  assert.ok(summarySection);
  const spec = ICH_M11_TEMPLATE_SECTION_SPECS.find((entry) => entry.id === '1')!;
  const result = calculateSectionSimilarity(summarySection!, spec);
  assert.ok(result.score >= 0.9);
  assert.ok(result.reasons.some((reason) => reason.includes('exact number')));
}

function testStructuralMappingFromCanonicalSections() {
  const paragraphs = [
    paragraph(0, '2 Study Objectives', { isHeadingStyle: true, headingLevel: 1 }),
    paragraph(1, 'Primary objective: Demonstrate improvement in overall survival for participants.'),
    paragraph(2, 'Secondary objective: Evaluate safety and tolerability.'),
  ];
  const source = detectSourceSections(
    'upload-mapping',
    'fixture.docx',
    paragraphs.map((entry) => entry.text).join('\n'),
    paragraphs,
    [],
    [],
    [],
  );
  saveCanonicalDocument(
    buildCanonicalDocument({
      uploadId: source.uploadId,
      filename: source.filename,
      paragraphs: source.paragraphs,
      headings: source.headings,
      tables: source.tables,
      fullText: source.fullText,
    }),
  );

  const output = evaluateStructuralMapping({ sourceExtraction: source, trigger: 'import' });
  const objectives = output.mappedSections.find((entry) => entry.mappedM11SectionId === '3');
  assert.ok(objectives);
  assert.match(objectives!.importedText, /overall survival/);
}

function testDetectSourceSectionsUsesCanonicalDocument() {
  const paragraphs = buildFixtureParagraphs();
  const source = detectSourceSections(
    'upload-detect',
    'fixture.docx',
    paragraphs.map((entry) => entry.text).join('\n'),
    paragraphs,
    [],
    [],
    [],
  );
  assert.ok(source.canonicalDocumentId?.startsWith('canonical-'));
  assert.ok(source.sections.length > 0);
  assert.ok(source.sections.every((section) => section.canonicalSectionId));
}

function testCanonicalSectionsAdapterMatchesLegacyShape() {
  const paragraphs = buildFixtureParagraphs();
  const document = buildCanonicalDocument({
    uploadId: 'upload-adapter',
    filename: 'fixture.docx',
    paragraphs,
    headings: [],
    tables: [],
    fullText: paragraphs.map((entry) => entry.text).join('\n'),
  });
  const candidates = canonicalSectionsToSourceCandidates(document, paragraphs);
  assert.ok(candidates.length >= document.sections.length - 1);
  assert.ok(candidates.every((candidate) => candidate.headingText.length > 0));
  assert.ok(candidates.every((candidate) => typeof candidate.importedTextLength === 'number'));
}

function testSectionCountComparison() {
  const paragraphs = buildFixtureParagraphs();
  const source = detectSourceSections(
    'upload-count',
    'fixture.docx',
    paragraphs.map((entry) => entry.text).join('\n'),
    paragraphs,
    [],
    [],
    [],
  );
  const mapping = toStructuralMappingResult(
    evaluateStructuralMapping({ sourceExtraction: source, trigger: 'import' }),
  );
  assert.ok(source.sections.length >= 2);
  assert.ok(mapping.mappings.length >= 1);
}

async function main() {
  testHeadingClassification();
  testTocClassification();
  testHeaderFooterDetection();
  testCanonicalSectionBoundaries();
  testNumberingNormalization();
  testSimilarityScoring();
  testStructuralMappingFromCanonicalSections();
  testDetectSourceSectionsUsesCanonicalDocument();
  testCanonicalSectionsAdapterMatchesLegacyShape();
  testSectionCountComparison();
  console.log('Canonical document tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
