import type { SoAEnrichmentProposal, SoAEnrichmentProposalStatus } from './soaEnrichmentProposal';

const STORAGE_KEY = 'm11-soa-enrichment-v1';

const listeners = new Set<() => void>();

let currentProposal: SoAEnrichmentProposal | null = null;

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
    currentProposal = raw ? (JSON.parse(raw) as SoAEnrichmentProposal) : null;
  } catch {
    currentProposal = null;
  }
}

export function subscribeSoAEnrichmentProposal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentSoAEnrichmentProposal(): SoAEnrichmentProposal | null {
  if (!currentProposal) {
    loadPersisted();
  }
  return currentProposal;
}

export function createSoAEnrichmentProposal(proposal: SoAEnrichmentProposal): SoAEnrichmentProposal {
  if (currentProposal?.status === 'proposed') {
    supersedeSoAEnrichmentProposal('Superseded by newer SoA enrichment run');
  }
  currentProposal = proposal;
  persist();
  notify();
  return currentProposal;
}

function updateProposalStatus(status: SoAEnrichmentProposalStatus, summarySuffix?: string): SoAEnrichmentProposal | null {
  if (!currentProposal) {
    return null;
  }
  currentProposal = {
    ...currentProposal,
    status,
    updatedAt: new Date().toISOString(),
    summary: summarySuffix ? `${currentProposal.summary} — ${summarySuffix}` : currentProposal.summary,
  };
  persist();
  notify();
  return currentProposal;
}

export function acceptSoAEnrichmentProposal(): SoAEnrichmentProposal | null {
  return updateProposalStatus('accepted', 'accepted');
}

export function rejectSoAEnrichmentProposal(): SoAEnrichmentProposal | null {
  return updateProposalStatus('rejected', 'rejected');
}

export function supersedeSoAEnrichmentProposal(reason?: string): SoAEnrichmentProposal | null {
  if (!currentProposal || currentProposal.status !== 'proposed') {
    return currentProposal;
  }
  return updateProposalStatus('superseded', reason ?? 'superseded');
}

export function clearSoAEnrichmentProposal(): void {
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

export function resetSoAEnrichmentStoreForTests(): void {
  clearSoAEnrichmentProposal();
}
