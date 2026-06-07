import type {
  SoAActivity,
  SoAAssessment,
  SoACondition,
  SoAEvidenceReference,
  SoAFootnote,
  SoAInferenceSource,
  SoAProcedure,
  SoAScheduleRule,
  SoATimingWindow,
  SoAVisit,
} from './soaKnowledgeTypes';
import type { SoAConfigurationPatch } from './soaConfigurationPatch';
import type { SoAKnowledgePatch } from './soaKnowledgeTypes';

export type SoAEnrichmentProposalStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';

export interface SoAEnrichmentProposalCounts {
  visits: number;
  assessments: number;
  procedures: number;
  activities: number;
  conditions: number;
  timingWindows: number;
  scheduleRules: number;
  footnotes: number;
}

export interface SoAEnrichmentRationaleEntry {
  itemKind: string;
  itemName: string;
  rationale: string;
  inferenceSource: SoAInferenceSource;
}

export type SoAEnrichedVisit = SoAVisit & {
  inferenceSource: SoAInferenceSource;
  evidence: SoAEvidenceReference[];
};

export type SoAEnrichedAssessment = SoAAssessment & {
  inferenceSource: SoAInferenceSource;
  evidence: SoAEvidenceReference[];
};

export type SoAEnrichedProcedure = SoAProcedure & {
  inferenceSource: SoAInferenceSource;
  evidence: SoAEvidenceReference[];
};

export type SoAEnrichedActivity = SoAActivity & {
  inferenceSource: SoAInferenceSource;
  evidence: SoAEvidenceReference[];
};

export type SoAEnrichedCondition = SoACondition & {
  inferenceSource: SoAInferenceSource;
  evidence: SoAEvidenceReference[];
};

export type SoAEnrichedTimingWindow = SoATimingWindow & {
  inferenceSource: SoAInferenceSource;
  evidence: SoAEvidenceReference[];
};

export type SoAEnrichedScheduleRule = SoAScheduleRule & {
  inferenceSource: SoAInferenceSource;
  evidence: SoAEvidenceReference[];
};

export type SoAEnrichedFootnote = SoAFootnote & {
  inferenceSource: SoAInferenceSource;
  evidence: SoAEvidenceReference[];
};

export interface SoAEnrichmentDiagnostics {
  hallucinationRiskWarnings: string[];
  unsupportedInferenceWarnings: string[];
  missingEvidenceWarnings: string[];
  conflictingScheduleStatements: string[];
}

export interface SoAEnrichmentProposal {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model?: string;
  status: SoAEnrichmentProposalStatus;
  summary: string;
  deterministicCounts: SoAEnrichmentProposalCounts;
  enrichedCounts: SoAEnrichmentProposalCounts;
  proposedVisits: SoAEnrichedVisit[];
  proposedAssessments: SoAEnrichedAssessment[];
  proposedProcedures: SoAEnrichedProcedure[];
  proposedActivities: SoAEnrichedActivity[];
  proposedConditions: SoAEnrichedCondition[];
  proposedTimingWindows: SoAEnrichedTimingWindow[];
  proposedScheduleRules: SoAEnrichedScheduleRule[];
  proposedFootnotes: SoAEnrichedFootnote[];
  diagnostics: string[];
  warnings: string[];
  hallucinationRiskWarnings: string[];
  unsupportedInferenceWarnings: string[];
  missingEvidenceWarnings: string[];
  conflictingScheduleStatements: string[];
  rationaleEntries: SoAEnrichmentRationaleEntry[];
  sourceSectionIds: string[];
  impactedNarrativeSections: Array<{ sectionId: string; reason: string }>;
  knowledgePatch?: SoAKnowledgePatch;
  configurationPatch?: SoAConfigurationPatch;
}

export function countEnrichmentProposalItems(proposal: Pick<
  SoAEnrichmentProposal,
  | 'proposedVisits'
  | 'proposedAssessments'
  | 'proposedProcedures'
  | 'proposedActivities'
  | 'proposedConditions'
  | 'proposedTimingWindows'
  | 'proposedScheduleRules'
  | 'proposedFootnotes'
>): SoAEnrichmentProposalCounts {
  return {
    visits: proposal.proposedVisits.length,
    assessments: proposal.proposedAssessments.length,
    procedures: proposal.proposedProcedures.length,
    activities: proposal.proposedActivities.length,
    conditions: proposal.proposedConditions.length,
    timingWindows: proposal.proposedTimingWindows.length,
    scheduleRules: proposal.proposedScheduleRules.length,
    footnotes: proposal.proposedFootnotes.length,
  };
}

export function enrichmentProposalToKnowledgePatch(proposal: SoAEnrichmentProposal): SoAKnowledgePatch {
  return {
    visits: proposal.proposedVisits,
    assessments: proposal.proposedAssessments,
    procedures: proposal.proposedProcedures,
    activities: proposal.proposedActivities,
    conditions: proposal.proposedConditions,
    timingWindows: proposal.proposedTimingWindows,
    scheduleRules: proposal.proposedScheduleRules,
    footnotes: proposal.proposedFootnotes,
    sourceSectionIds: proposal.sourceSectionIds,
    extractionNotes: [
      `SoA LLM enrichment accepted (${proposal.provider}${proposal.model ? ` · ${proposal.model}` : ''}).`,
    ],
  };
}
