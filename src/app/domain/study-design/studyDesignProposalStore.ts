import type { NarrativeImpactProposal, StudyDesignSyncProposal } from './StudyDesignTypes';

const NARRATIVE_IMPACT_KEY = 'm11-study-design-narrative-impact-v1';
const SYNC_PROPOSAL_KEY = 'm11-study-design-sync-proposal-v1';

const listeners = new Set<() => void>();

let currentNarrativeImpact: NarrativeImpactProposal | null = null;
let currentSyncProposal: StudyDesignSyncProposal | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!currentNarrativeImpact) localStorage.removeItem(NARRATIVE_IMPACT_KEY);
    else localStorage.setItem(NARRATIVE_IMPACT_KEY, JSON.stringify(currentNarrativeImpact));
    if (!currentSyncProposal) localStorage.removeItem(SYNC_PROPOSAL_KEY);
    else localStorage.setItem(SYNC_PROPOSAL_KEY, JSON.stringify(currentSyncProposal));
  } catch {
    // ignore
  }
}

function load(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    currentNarrativeImpact = JSON.parse(
      localStorage.getItem(NARRATIVE_IMPACT_KEY) ?? 'null',
    ) as NarrativeImpactProposal | null;
    currentSyncProposal = JSON.parse(
      localStorage.getItem(SYNC_PROPOSAL_KEY) ?? 'null',
    ) as StudyDesignSyncProposal | null;
  } catch {
    currentNarrativeImpact = null;
    currentSyncProposal = null;
  }
}

export function subscribeStudyDesignProposals(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentNarrativeImpactProposal(): NarrativeImpactProposal | null {
  if (!currentNarrativeImpact) load();
  return currentNarrativeImpact;
}

export function getCurrentStudyDesignSyncProposal(): StudyDesignSyncProposal | null {
  if (!currentSyncProposal) load();
  return currentSyncProposal;
}

export function setNarrativeImpactProposal(proposal: NarrativeImpactProposal): NarrativeImpactProposal {
  currentNarrativeImpact = proposal;
  persist();
  notify();
  return proposal;
}

export function setStudyDesignSyncProposal(proposal: StudyDesignSyncProposal): StudyDesignSyncProposal {
  currentSyncProposal = proposal;
  persist();
  notify();
  return proposal;
}

export function clearStudyDesignProposals(): void {
  currentNarrativeImpact = null;
  currentSyncProposal = null;
  persist();
  notify();
}

export function resetStudyDesignProposalsForTests(): void {
  clearStudyDesignProposals();
}
