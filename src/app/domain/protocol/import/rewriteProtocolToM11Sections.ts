/**
 * LLM rewrite boundary — v1 returns placeholder drafts; swap implementation for real LLM later.
 */

import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import type { IchM11SectionSpec } from '../ichM11/types';
import type { GeneratedSectionDraft, ProtocolSourceArtifact } from './types';

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

function buildDraftText(spec: IchM11SectionSpec, artifact: ProtocolSourceArtifact): string {
  if (spec.metadata?.viewKind === 'schedule-of-activities') {
    return SOA_PLACEHOLDER;
  }
  return `${PLACEHOLDER_BODY}\n\nSource: ${artifact.filename}\nM11 section: ${spec.title}`;
}

/** Generates M11 section draft proposals (never auto-approved). */
export function rewriteProtocolToM11Sections(
  sourceDocument: ProtocolSourceArtifact,
  templateSpecs: IchM11SectionSpec[] = ICH_M11_TEMPLATE_SECTION_SPECS,
): GeneratedSectionDraft[] {
  const generatedAt = new Date().toISOString();
  const drafts: GeneratedSectionDraft[] = [];

  for (const spec of templateSpecs) {
    if (!shouldGenerateDraftForSpec(spec)) {
      continue;
    }

    drafts.push({
      sectionId: spec.id,
      title: spec.title,
      generatedText: buildDraftText(spec, sourceDocument),
      sourceUploadId: sourceDocument.id,
      generationStatus: 'generated',
      reviewStatus: 'pending-review',
      generatedAt,
      validationStatus: 'not-run',
      validationMessages: [],
    });
  }

  return drafts;
}
