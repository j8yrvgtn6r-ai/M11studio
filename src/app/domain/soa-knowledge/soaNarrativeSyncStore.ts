import {
  createSoANarrativeImpactRecord,
  getNarrativeSectionsImpactedBySoAChange,
  getSoAFieldsImpactedByNarrativeSection,
} from './soaKnowledgeNarrativeSync';
import type {
  SoANarrativeSyncProposal,
  SoANarrativeSyncProposalStatus,
  SoANarrativeSyncSource,
  SoAProposedNarrativeUpdate,
  SoASectionRefreshDiagnostic,
} from './soaNarrativeSyncProposal';

const STORAGE_KEY = 'm11-soa-narrative-sync-v1';
const DIAGNOSTICS_KEY = 'm11-soa-narrative-sync-diagnostics-v1';

const listeners = new Set<() => void>();

let currentProposal: SoANarrativeSyncProposal | null = null;
let refreshDiagnostics: SoASectionRefreshDiagnostic[] = [];

function notify(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!currentProposal) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProposal));
    }
    localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(refreshDiagnostics.slice(-100)));
  } catch {
    // Ignore storage failures.
  }
}

function loadPersisted(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    currentProposal = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as SoANarrativeSyncProposal | null;
    refreshDiagnostics = JSON.parse(localStorage.getItem(DIAGNOSTICS_KEY) ?? '[]') as SoASectionRefreshDiagnostic[];
  } catch {
    currentProposal = null;
    refreshDiagnostics = [];
  }
}

export function subscribeSoANarrativeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentSoANarrativeSyncProposal(): SoANarrativeSyncProposal | null {
  if (!currentProposal) loadPersisted();
  return currentProposal;
}

export function getSoASectionRefreshDiagnostics(): SoASectionRefreshDiagnostic[] {
  if (refreshDiagnostics.length === 0) loadPersisted();
  return [...refreshDiagnostics];
}

function buildProposedUpdates(sectionIds: string[], reason: string): SoAProposedNarrativeUpdate[] {
  return sectionIds.map((sectionId) => ({
    sectionId,
    reason,
    suggestedNote: `Section ${sectionId} may need review because SoA schedule rules changed.`,
  }));
}

export function createSoANarrativeSyncProposal(options: {
  source: SoANarrativeSyncSource;
  impactedSectionIds: string[];
  reason: string;
  relatedProposalId?: string;
  proposedNarrativeUpdates?: SoAProposedNarrativeUpdate[];
}): SoANarrativeSyncProposal {
  const now = new Date().toISOString();
  currentProposal = {
    id: `soa-narrative-sync-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    source: options.source,
    impactedSectionIds: [...new Set(options.impactedSectionIds)],
    reason: options.reason,
    proposedNarrativeUpdates:
      options.proposedNarrativeUpdates ??
      buildProposedUpdates(options.impactedSectionIds, options.reason),
    status: 'proposed',
    relatedProposalId: options.relatedProposalId,
  };
  persist();
  notify();
  return currentProposal;
}

export function createSoANarrativeSyncProposalFromSoAAcceptance(options: {
  relatedProposalId?: string;
  changeKind?: 'assessmentSchedule' | 'visitTiming' | 'scheduleRuleChanged';
}): SoANarrativeSyncProposal | null {
  const impactedSectionIds = getNarrativeSectionsImpactedBySoAChange({
    kind: options.changeKind ?? 'scheduleRuleChanged',
  });
  if (impactedSectionIds.length === 0) return null;
  const impact = createSoANarrativeImpactRecord({ kind: options.changeKind ?? 'scheduleRuleChanged' });
  return createSoANarrativeSyncProposal({
    source: 'soaProposalAccepted',
    impactedSectionIds,
    reason: 'SoA proposal accepted — narrative sections may require synchronization.',
    relatedProposalId: options.relatedProposalId,
    proposedNarrativeUpdates: impactedSectionIds.map((sectionId) => ({
      sectionId,
      reason: impact.reasons[sectionId] ?? 'Related narrative may require review after SoA knowledge change.',
      suggestedNote: `Section ${sectionId} may need review because SoA schedule rules changed.`,
    })),
  });
}

function updateStatus(status: SoANarrativeSyncProposalStatus): SoANarrativeSyncProposal | null {
  if (!currentProposal) return null;
  currentProposal = { ...currentProposal, status, updatedAt: new Date().toISOString() };
  persist();
  notify();
  return currentProposal;
}

export function acceptSoANarrativeSyncProposal(): SoANarrativeSyncProposal | null {
  return updateStatus('accepted');
}

export function rejectSoANarrativeSyncProposal(): SoANarrativeSyncProposal | null {
  return updateStatus('rejected');
}

export function flagSoARefreshNeededForNarrativeSection(sectionId: string): SoASectionRefreshDiagnostic {
  const impactedFields = getSoAFieldsImpactedByNarrativeSection(sectionId);
  const diagnostic: SoASectionRefreshDiagnostic = {
    sectionId,
    message:
      impactedFields.length > 0
        ? `Section ${sectionId} was edited; SoA ${impactedFields.join(', ')} may require refresh.`
        : `Section ${sectionId} was edited; run SoA Agent if schedule content changed.`,
    createdAt: new Date().toISOString(),
    inferenceSource: 'deterministic',
  };
  refreshDiagnostics = [...refreshDiagnostics.filter((entry) => entry.sectionId !== sectionId), diagnostic];
  persist();
  notify();
  return diagnostic;
}

export function clearSoANarrativeSyncState(): void {
  currentProposal = null;
  refreshDiagnostics = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DIAGNOSTICS_KEY);
  }
  notify();
}

export function resetSoANarrativeSyncStoreForTests(): void {
  clearSoANarrativeSyncState();
}
