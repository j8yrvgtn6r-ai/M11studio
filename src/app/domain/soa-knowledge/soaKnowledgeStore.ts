import { applySoAKnowledgePatch, createEmptySoAKnowledgeModel } from './soaKnowledgePatch';
import type { SoAKnowledgeModel, SoAKnowledgePatch } from './soaKnowledgeTypes';

const STORAGE_KEY = 'm11-soa-knowledge-v1';

const listeners = new Set<() => void>();

let soaKnowledge: SoAKnowledgeModel | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function persistModel(model: SoAKnowledgeModel | null): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    if (!model) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function loadPersistedModel(): SoAKnowledgeModel | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SoAKnowledgeModel;
  } catch {
    return null;
  }
}

export function subscribeSoAKnowledge(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSoAKnowledge(): SoAKnowledgeModel | null {
  if (!soaKnowledge) {
    soaKnowledge = loadPersistedModel();
  }
  return soaKnowledge;
}

export function setSoAKnowledge(model: SoAKnowledgeModel): SoAKnowledgeModel {
  soaKnowledge = {
    ...model,
    updatedAt: new Date().toISOString(),
  };
  persistModel(soaKnowledge);
  notify();
  return soaKnowledge;
}

export function patchSoAKnowledge(patch: SoAKnowledgePatch): SoAKnowledgeModel {
  const base = getSoAKnowledge() ?? createEmptySoAKnowledgeModel(patch.protocolId);
  soaKnowledge = applySoAKnowledgePatch(base, patch);
  persistModel(soaKnowledge);
  notify();
  return soaKnowledge;
}

export function clearSoAKnowledge(): void {
  soaKnowledge = null;
  persistModel(null);
  notify();
}

export function resetSoAKnowledgeForTests(): void {
  soaKnowledge = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
