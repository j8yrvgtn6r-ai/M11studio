import type { SoAConfigurationPatch } from './soaConfigurationPatch';
import type { SoAKnowledgePatch } from './soaKnowledgeTypes';

export type SoAAgentTrigger =
  | 'import'
  | 'manual'
  | 'sectionEdit'
  | 'validationAccepted'
  | 'regenerateSoA'
  | 'generateFirstPass'
  | 'syncFromNarrative'
  | 'syncFromSoAEdit';

export type SoAProposalStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';

export interface SoAProposal {
  id: string;
  createdAt: string;
  updatedAt: string;
  trigger: SoAAgentTrigger;
  status: SoAProposalStatus;
  summary: string;
  soaKnowledgePatch: SoAKnowledgePatch;
  configurationPatch?: SoAConfigurationPatch;
  impactedNarrativeSections: Array<{ sectionId: string; reason: string }>;
  diagnostics: string[];
  warnings: string[];
  sourceSectionIds: string[];
  counts: {
    arms: number;
    epochs: number;
    elements: number;
    visits: number;
    activities: number;
    assessments: number;
    scheduleRules: number;
    conditions: number;
    footnotes: number;
  };
}

export interface SoAProposalHistoryEntry {
  id: string;
  status: SoAProposalStatus;
  updatedAt: string;
  summary: string;
}
