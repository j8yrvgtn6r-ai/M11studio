import type { ProtocolSection } from '../../../types/protocol';
import type { GeneratedSectionDraft } from '../import/types';
import { applyManualSectionContentEdit } from '../import/sectionAuthoring';
import { getProtocolImportState } from '../import/protocolImportStore';
import { stripHtmlToPlainText } from '../authoring/richTextContent';
import { resolveSectionEditorContent } from '../import/sectionAuthoring';
import { flattenProtocolSections } from './protocolSearch';
import { previewFindReplace, type FindReplaceOptions, type FindReplacePreviewItem } from './findReplace';

export type ReplaceTransactionScope = 'section' | 'protocol';

export interface ReplaceTransactionMatch {
  id: string;
  sectionId: string;
  sectionTitle: string;
  lineNumber: number;
  before: string;
  after: string;
  snippet: string;
  startOffset: number;
  endOffset: number;
  included: boolean;
}

export interface ReplaceTransaction {
  id: string;
  createdAt: string;
  query: string;
  replacement: string;
  scope: ReplaceTransactionScope;
  matches: ReplaceTransactionMatch[];
  appliedAt?: string;
  revertedAt?: string;
  affectedSectionIds: string[];
  snapshots: Record<string, string>;
}

const STORAGE_KEY = 'm11-replace-transactions-v1';

let transactions: ReplaceTransaction[] = loadTransactions();
let lastApplied: ReplaceTransaction | null =
  [...transactions].reverse().find((entry) => entry.appliedAt && !entry.revertedAt) ?? null;

function loadTransactions(): ReplaceTransaction[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ReplaceTransaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistTransactions(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions.slice(-20)));
}

export function clearReplaceTransactions(): void {
  transactions = [];
  lastApplied = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getLastAppliedReplaceTransaction(): ReplaceTransaction | null {
  return lastApplied;
}

function previewItemToMatch(item: FindReplacePreviewItem, included: boolean): ReplaceTransactionMatch {
  return {
    id: item.matchId,
    sectionId: item.sectionId,
    sectionTitle: item.sectionTitle,
    lineNumber: item.lineNumber,
    before: item.before,
    after: item.after,
    snippet: item.snippet,
    startOffset: item.startOffset,
    endOffset: item.endOffset,
    included,
  };
}

/** Builds preview matches with stable ids and include flags for transactional replace. */
export function buildReplacePreviewWithMatches(
  options: FindReplaceOptions,
  sections: ProtocolSection[],
  drafts: Record<string, GeneratedSectionDraft>,
  includedIds?: Set<string>,
): ReplaceTransactionMatch[] {
  const preview = previewFindReplace(options, sections, drafts);
  return preview.items.map((item) => previewItemToMatch(item, includedIds ? includedIds.has(item.matchId) : true));
}

function applyMatchesToText(text: string, matches: ReplaceTransactionMatch[]): string {
  const sorted = [...matches].sort((a, b) => b.startOffset - a.startOffset);
  let next = text;
  for (const match of sorted) {
    next = `${next.slice(0, match.startOffset)}${match.after}${next.slice(match.endOffset)}`;
  }
  return next;
}

async function triggerPostReplaceAgents(sectionId: string, sectionTitle: string, currentText: string, previousText: string): Promise<void> {
  const { scheduleKnowledgeAgentForSectionEdit } = await import('../../../agents/knowledgeAgentRunner');
  scheduleKnowledgeAgentForSectionEdit({
    sectionId,
    sectionTitle,
    currentText,
    previousText,
  });
}

export interface ApplyReplaceResult {
  applied: boolean;
  transaction?: ReplaceTransaction;
  reason?: string;
}

/** Applies selected replace matches as one transaction with undo snapshot. */
export async function applyReplaceTransaction(
  options: FindReplaceOptions,
  sections: ProtocolSection[],
  drafts: Record<string, GeneratedSectionDraft>,
  selectedMatchIds: string[],
): Promise<ApplyReplaceResult> {
  if (!options.find.trim()) {
    return { applied: false, reason: 'Find query is empty.' };
  }

  const allMatches = buildReplacePreviewWithMatches(options, sections, drafts);
  const selected = allMatches.filter((match) => selectedMatchIds.includes(match.id));
  if (selected.length === 0) {
    return { applied: false, reason: 'No matches selected.' };
  }

  const flat = flattenProtocolSections(sections);
  const snapshots: Record<string, string> = {};
  const bySection = new Map<string, ReplaceTransactionMatch[]>();

  for (const match of selected) {
    const bucket = bySection.get(match.sectionId) ?? [];
    bucket.push(match);
    bySection.set(match.sectionId, bucket);
  }

  for (const [sectionId, sectionMatches] of bySection) {
    const draft = drafts[sectionId] ?? getProtocolImportState().sectionDrafts[sectionId];
    if (!draft) {
      continue;
    }
    const current = stripHtmlToPlainText(resolveSectionEditorContent(draft));
    snapshots[sectionId] = current;
    const updated = applyMatchesToText(current, sectionMatches);
    const sectionTitle = flat.find((section) => section.id === sectionId)?.title ?? draft.title;
    applyManualSectionContentEdit(sectionId, sectionTitle, updated, current);
    await triggerPostReplaceAgents(sectionId, sectionTitle, updated, current);
  }

  const transaction: ReplaceTransaction = {
    id: `replace.${Date.now()}`,
    createdAt: new Date().toISOString(),
    query: options.find,
    replacement: options.replace,
    scope: options.scope,
    matches: selected.map((match) => ({ ...match, included: true })),
    appliedAt: new Date().toISOString(),
    affectedSectionIds: [...bySection.keys()],
    snapshots,
  };

  transactions = [...transactions, transaction];
  lastApplied = transaction;
  persistTransactions();
  return { applied: true, transaction };
}

export interface UndoReplaceResult {
  reverted: boolean;
  reason?: string;
}

/** Restores content from the last applied replace transaction. */
export async function undoLastReplaceTransaction(sections: ProtocolSection[]): Promise<UndoReplaceResult> {
  if (!lastApplied || lastApplied.revertedAt) {
    return { reverted: false, reason: 'No applied replace transaction to undo.' };
  }

  const flat = flattenProtocolSections(sections);
  for (const sectionId of lastApplied.affectedSectionIds) {
    const snapshot = lastApplied.snapshots[sectionId];
    if (snapshot === undefined) {
      continue;
    }
    const draft = getProtocolImportState().sectionDrafts[sectionId];
    if (!draft) {
      continue;
    }
    const current = stripHtmlToPlainText(resolveSectionEditorContent(draft));
    const sectionTitle = flat.find((section) => section.id === sectionId)?.title ?? draft.title;
    applyManualSectionContentEdit(sectionId, sectionTitle, snapshot, current);
    await triggerPostReplaceAgents(sectionId, sectionTitle, snapshot, current);
  }

  lastApplied = {
    ...lastApplied,
    revertedAt: new Date().toISOString(),
  };
  transactions = transactions.map((entry) => (entry.id === lastApplied!.id ? lastApplied! : entry));
  persistTransactions();
  return { reverted: true };
}

export function groupMatchesBySection(matches: ReplaceTransactionMatch[]): Map<string, ReplaceTransactionMatch[]> {
  const grouped = new Map<string, ReplaceTransactionMatch[]>();
  for (const match of matches) {
    const bucket = grouped.get(match.sectionId) ?? [];
    bucket.push(match);
    grouped.set(match.sectionId, bucket);
  }
  return grouped;
}
