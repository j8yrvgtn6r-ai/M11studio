import type { SoAProposal, SoAProposalHistoryEntry, SoAProposalStatus } from './soaProposalTypes';
import type { SoAAgentTrigger } from './soaProposalTypes';
import type { SoAConfigurationPatch } from './soaConfigurationPatch';
import type { SoAKnowledgePatch } from './soaKnowledgeTypes';

const STORAGE_KEY = 'm11-soa-proposal-v1';
const HISTORY_KEY = 'm11-soa-proposal-history-v1';

const listeners = new Set<() => void>();

let currentProposal: SoAProposal | null = null;
let proposalHistory: SoAProposalHistoryEntry[] = [];

function notify(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    if (!currentProposal) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProposal));
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(proposalHistory.slice(-50)));
  } catch {
    // Ignore storage failures.
  }
}

function loadPersisted(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    currentProposal = raw ? (JSON.parse(raw) as SoAProposal) : null;
    const historyRaw = localStorage.getItem(HISTORY_KEY);
    proposalHistory = historyRaw ? (JSON.parse(historyRaw) as SoAProposalHistoryEntry[]) : [];
  } catch {
    currentProposal = null;
    proposalHistory = [];
  }
}

export function subscribeSoAProposal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentSoAProposal(): SoAProposal | null {
  if (!currentProposal) {
    loadPersisted();
  }
  return currentProposal;
}

export function getSoAProposalHistory(): SoAProposalHistoryEntry[] {
  if (proposalHistory.length === 0) {
    loadPersisted();
  }
  return [...proposalHistory];
}

function recordHistory(proposal: SoAProposal): void {
  proposalHistory = [
    ...proposalHistory.filter((entry) => entry.id !== proposal.id),
    {
      id: proposal.id,
      status: proposal.status,
      updatedAt: proposal.updatedAt,
      summary: proposal.summary,
    },
  ];
}

export interface CreateSoAProposalInput {
  trigger: SoAAgentTrigger;
  summary: string;
  soaKnowledgePatch: SoAKnowledgePatch;
  configurationPatch?: SoAConfigurationPatch;
  impactedNarrativeSections: Array<{ sectionId: string; reason: string }>;
  diagnostics: string[];
  warnings: string[];
  sourceSectionIds: string[];
  counts: SoAProposal['counts'];
}

export function createSoAProposal(input: CreateSoAProposalInput): SoAProposal {
  if (currentProposal?.status === 'proposed') {
    supersedeSoAProposal('Superseded by newer SoA Agent run');
  }

  const now = new Date().toISOString();
  currentProposal = {
    id: `soa-proposal-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    trigger: input.trigger,
    status: 'proposed',
    summary: input.summary,
    soaKnowledgePatch: input.soaKnowledgePatch,
    configurationPatch: input.configurationPatch,
    impactedNarrativeSections: input.impactedNarrativeSections,
    diagnostics: input.diagnostics,
    warnings: input.warnings,
    sourceSectionIds: input.sourceSectionIds,
    counts: input.counts,
  };
  recordHistory(currentProposal);
  persist();
  notify();
  return currentProposal;
}

function updateProposalStatus(status: SoAProposalStatus, summarySuffix?: string): SoAProposal | null {
  if (!currentProposal) {
    return null;
  }
  currentProposal = {
    ...currentProposal,
    status,
    updatedAt: new Date().toISOString(),
    summary: summarySuffix ? `${currentProposal.summary} — ${summarySuffix}` : currentProposal.summary,
  };
  recordHistory(currentProposal);
  persist();
  notify();
  return currentProposal;
}

export function acceptSoAProposal(): SoAProposal | null {
  return updateProposalStatus('accepted', 'accepted');
}

export function rejectSoAProposal(): SoAProposal | null {
  return updateProposalStatus('rejected', 'rejected');
}

export function supersedeSoAProposal(reason?: string): SoAProposal | null {
  if (!currentProposal || currentProposal.status !== 'proposed') {
    return currentProposal;
  }
  return updateProposalStatus('superseded', reason ?? 'superseded');
}

/** Clears the active SoA proposal from memory and localStorage. */
export function clearSoAProposal(): void {
  currentProposal = null;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
  notify();
}

export function clearSoAProposalForTests(): void {
  clearSoAProposal();
  proposalHistory = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(HISTORY_KEY);
  }
}

export function resetSoAProposalStoreForTests(): void {
  clearSoAProposalForTests();
}
