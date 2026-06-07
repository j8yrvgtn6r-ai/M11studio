import type { SoAInferenceSource } from './soaKnowledgeTypes';

export type SoANarrativeSyncProposalStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';

export type SoANarrativeSyncSource = 'soaProposalAccepted' | 'soaEdit' | 'manual';

export interface SoAProposedNarrativeUpdate {
  sectionId: string;
  reason: string;
  suggestedNote: string;
  proposedText?: string;
}

export interface SoANarrativeSyncProposal {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: SoANarrativeSyncSource;
  impactedSectionIds: string[];
  reason: string;
  proposedNarrativeUpdates: SoAProposedNarrativeUpdate[];
  status: SoANarrativeSyncProposalStatus;
  relatedProposalId?: string;
}

export interface SoASectionRefreshDiagnostic {
  sectionId: string;
  message: string;
  createdAt: string;
  inferenceSource?: SoAInferenceSource;
}
