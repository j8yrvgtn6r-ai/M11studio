import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import { listM11GenerationTargetSectionIds } from './importVisualizationUtils';
import type { GeneratedSectionDraft } from '../types';

/** Priority M11 sections generated during initial Quick Reconstruction import. */
export const QUICK_RECONSTRUCTION_SECTION_IDS = [
  '1.1',
  '1.1.1',
  '1.1.2',
  '1.2',
  '3',
  '3.1',
  '3.1.1',
  '3.2',
  '3.2.1',
  '3.3',
  '3.3.1',
  '4',
  '4.1',
  '4.2',
  '5',
  '5.1',
  '5.2',
  '5.3',
  '6',
  '6.1',
  '6.2',
  '6.3',
  '6.7',
  '8',
  '8.1',
  '8.2',
  '8.3',
  '8.4',
  '9',
  '9.1',
  '9.2',
  '10',
  '10.1',
  '10.4',
  '10.11',
] as const;

export type QuickReconstructionSectionId = (typeof QUICK_RECONSTRUCTION_SECTION_IDS)[number];

const quickSet = new Set<string>(QUICK_RECONSTRUCTION_SECTION_IDS);

export function isQuickReconstructionSection(sectionId: string): boolean {
  return quickSet.has(sectionId);
}

export function listQuickReconstructionSectionIds(): string[] {
  return listM11GenerationTargetSectionIds([...QUICK_RECONSTRUCTION_SECTION_IDS]).filter((id) =>
    quickSet.has(id),
  );
}

export function listNotGeneratedM11SectionIds(): string[] {
  return listM11GenerationTargetSectionIds().filter((id) => !quickSet.has(id));
}

export function listSectionsEligibleForGeneration(
  sectionDrafts: Record<string, GeneratedSectionDraft>,
): string[] {
  return listM11GenerationTargetSectionIds().filter((sectionId) => {
    const draft = sectionDrafts[sectionId];
    return !draft || draft.generationStatus === 'failed';
  });
}

export function countPendingM11Sections(sectionDrafts: Record<string, GeneratedSectionDraft>): number {
  return listM11GenerationTargetSectionIds().filter((sectionId) => {
    const draft = sectionDrafts[sectionId];
    return !draft || draft.generationStatus === 'failed';
  }).length;
}

export function getQuickReconstructionSectionTitle(sectionId: string): string | undefined {
  return ICH_M11_TEMPLATE_SECTION_SPECS.find((spec) => spec.id === sectionId)?.title;
}
