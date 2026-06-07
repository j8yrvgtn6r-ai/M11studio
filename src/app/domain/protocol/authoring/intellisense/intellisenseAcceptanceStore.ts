import type { IntellisenseAcceptanceRecord } from './intellisenseTypes';
import { getProtocolImportState, updateSectionImportDraft } from '../../import/protocolImportStore';
import { recordTerminologyAcceptance } from '../terminologyEditorIntegration';

const STORAGE_KEY = 'm11-intellisense-acceptance-v1';

let acceptanceLog: IntellisenseAcceptanceRecord[] = loadAcceptanceLog();
const listeners = new Set<(records: IntellisenseAcceptanceRecord[]) => void>();

function loadAcceptanceLog(): IntellisenseAcceptanceRecord[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as IntellisenseAcceptanceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistAcceptanceLog(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acceptanceLog.slice(-200)));
  }
  for (const listener of listeners) {
    listener([...acceptanceLog]);
  }
}

export function listIntellisenseAcceptanceRecords(sectionId?: string): IntellisenseAcceptanceRecord[] {
  if (!sectionId) {
    return [...acceptanceLog];
  }
  return acceptanceLog.filter((entry) => entry.sectionId === sectionId);
}

export function recordIntellisenseAcceptance(
  input: Omit<IntellisenseAcceptanceRecord, 'id' | 'timestamp'>,
): IntellisenseAcceptanceRecord {
  const entry: IntellisenseAcceptanceRecord = {
    ...input,
    id: `intellisense.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  acceptanceLog = [...acceptanceLog, entry];
  persistAcceptanceLog();

  const draft = getProtocolImportState().sectionDrafts[input.sectionId];
  if (draft) {
    updateSectionImportDraft(input.sectionId, {
      intellisenseAcceptanceLog: [...(draft.intellisenseAcceptanceLog ?? []), entry],
    });
  }

  if (input.kind === 'terminology' || input.kind === 'synonym') {
    recordTerminologyAcceptance(input.sectionId, {
      acceptedTerm: input.insertedText,
      preferredTerm: input.insertedText,
      codelistName: input.metadata?.codelistName ?? 'M11 Terminology',
      codelistId: input.metadata?.codelistId,
      termCode: input.metadata?.code,
      originalToken: input.originalText,
    });
  }

  return entry;
}

export function clearIntellisenseAcceptanceRecords(): void {
  acceptanceLog = [];
  persistAcceptanceLog();
}

export function subscribeIntellisenseAcceptanceRecords(
  listener: (records: IntellisenseAcceptanceRecord[]) => void,
): () => void {
  listeners.add(listener);
  listener([...acceptanceLog]);
  return () => listeners.delete(listener);
}

export function reloadIntellisenseAcceptanceRecordsFromStorage(): void {
  acceptanceLog = loadAcceptanceLog();
}
