/**
 * LLM rewrite boundary — v2 feeds real extracted source; text remains placeholder until LLM is wired.
 */

import { findRelevantSourceCandidates } from './m11SourceSectionMapping';
import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../ichM11/types';
import type {
  GeneratedSectionDraft,
  ImportedProtocolSource,
  ProtocolSourceArtifact,
} from './types';

const PLACEHOLDER_BODY =
  'Draft generated from uploaded protocol pending LLM integration. This section was rewritten into the ICH M11 Template structure and requires human review before it becomes approved protocol content.';

const SOA_PLACEHOLDER =
  'Schedule of Activities content is not extracted in v1. Continue authoring visits, assessments, and schedule rules in SoA Configuration. The uploaded DOCX remains available as the reference source artifact.';

function shouldGenerateDraftForSpec(spec: IchM11SectionSpec): boolean {
  if (spec.sectionType === 'template-instruction') {
    return false;
  }
  if (spec.id === '0' || spec.id.startsWith('0.')) {
    return false;
  }
  return true;
}

function excerpt(text: string, maxLength = 280): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}

function buildDraftText(
  spec: IchM11SectionSpec,
  artifact: ProtocolSourceArtifact,
  importedSource: ImportedProtocolSource,
  matchedIds: string[],
): string {
  if (spec.metadata?.viewKind === 'schedule-of-activities') {
    return SOA_PLACEHOLDER;
  }

  const matched = importedSource.sections.filter((section) => matchedIds.includes(section.id));
  const sourcePreview =
    matched.length > 0
      ? matched.map((section) => `• ${section.headingText}: ${excerpt(section.text, 200)}`).join('\n')
      : '• No mapped source section — full document context available in Source Extraction panel.';

  return [
    PLACEHOLDER_BODY,
    '',
    `Source file: ${artifact.filename}`,
    `M11 section: ${spec.title}`,
    `Extraction: ${importedSource.sections.length} source section candidate(s), ${importedSource.paragraphs.length} paragraph(s)`,
    '',
    'Matched source excerpt(s):',
    sourcePreview,
  ].join('\n');
}

/** Generates M11 section draft proposals (never auto-approved). */
export function rewriteProtocolToM11Sections(
  importedSource: ImportedProtocolSource,
  artifact: ProtocolSourceArtifact,
  templateSpecs: IchM11SectionSpec[] = ICH_M11_TEMPLATE_SECTION_SPECS,
): GeneratedSectionDraft[] {
  const generatedAt = new Date().toISOString();
  const drafts: GeneratedSectionDraft[] = [];

  for (const spec of templateSpecs) {
    if (!shouldGenerateDraftForSpec(spec)) {
      continue;
    }

    const matched = findRelevantSourceCandidates(spec.id, spec.title, importedSource.sections);
    const matchedIds = matched.map((section) => section.id);

    drafts.push({
      sectionId: spec.id,
      title: spec.title,
      generatedText: buildDraftText(spec, artifact, importedSource, matchedIds),
      sourceUploadId: artifact.id,
      sourceExtractionId: importedSource.uploadId,
      matchedSourceCandidateIds: matchedIds,
      extractionStatus: 'real-docx-parsed',
      generationStatus: 'generated',
      reviewStatus: 'pending-review',
      generatedAt,
      validationStatus: 'not-run',
      validationMessages: [],
    });
  }

  return drafts;
}
