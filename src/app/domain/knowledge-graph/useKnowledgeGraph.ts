import { useSyncExternalStore } from 'react';

import { getKnowledgeGraphSummary } from './knowledgeGraphQueries';
import { subscribeKnowledgeGraph } from './knowledgeGraphStore';
import type { KnowledgeGraphSummary } from './knowledgeGraphTypes';

export function useKnowledgeGraphSummary(): KnowledgeGraphSummary {
  return useSyncExternalStore(subscribeKnowledgeGraph, getKnowledgeGraphSummary, getKnowledgeGraphSummary);
}
