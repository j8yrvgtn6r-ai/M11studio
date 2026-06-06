import type { StudyModel } from '../study-model/studyModelTypes';
import { buildKnowledgeGraphFromStudyModel } from './knowledgeGraphBuilder';
import { applyKnowledgeGraphPatch, createEmptyKnowledgeGraph } from './knowledgeGraphPatch';
import type { KnowledgeGraph, KnowledgeGraphPatch } from './knowledgeGraphTypes';

const STORAGE_KEY = 'm11-knowledge-graph-v1';

const listeners = new Set<() => void>();

let knowledgeGraph: KnowledgeGraph | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function persistGraph(graph: KnowledgeGraph | null): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    if (!graph) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
  } catch {
    // Ignore quota / private mode failures.
  }
}

function loadPersistedGraph(): KnowledgeGraph | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as KnowledgeGraph;
  } catch {
    return null;
  }
}

export function subscribeKnowledgeGraph(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getKnowledgeGraph(): KnowledgeGraph | null {
  if (!knowledgeGraph) {
    knowledgeGraph = loadPersistedGraph();
  }
  return knowledgeGraph;
}

export function patchKnowledgeGraph(patch: KnowledgeGraphPatch): KnowledgeGraph {
  const base = getKnowledgeGraph() ?? createEmptyKnowledgeGraph();
  knowledgeGraph = applyKnowledgeGraphPatch(base, patch);
  persistGraph(knowledgeGraph);
  notify();
  return knowledgeGraph;
}

export function rebuildKnowledgeGraphFromStudyModel(
  studyModel: StudyModel | null | undefined,
  protocolId?: string,
): KnowledgeGraph {
  knowledgeGraph = buildKnowledgeGraphFromStudyModel(studyModel, protocolId);
  persistGraph(knowledgeGraph);
  notify();
  return knowledgeGraph;
}

export function mergeKnowledgeGraphFromStudyModel(
  studyModel: StudyModel | null | undefined,
  protocolId?: string,
): KnowledgeGraph {
  const built = buildKnowledgeGraphFromStudyModel(studyModel, protocolId);
  const base = getKnowledgeGraph() ?? createEmptyKnowledgeGraph(protocolId);
  knowledgeGraph = applyKnowledgeGraphPatch(base, {
    entities: built.entities,
    relationships: built.relationships,
  });
  persistGraph(knowledgeGraph);
  notify();
  return knowledgeGraph;
}

export function clearKnowledgeGraph(): void {
  knowledgeGraph = null;
  persistGraph(null);
  notify();
}

export function resetKnowledgeGraphForTests(): void {
  knowledgeGraph = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
