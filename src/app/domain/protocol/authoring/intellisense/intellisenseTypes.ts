import type { KnowledgeGraph } from '../../../knowledge-graph/knowledgeGraphTypes';
import type { SoAKnowledgeModel } from '../../../soa-knowledge/soaKnowledgeTypes';
import type { StudyModel } from '../../../study-model/studyModelTypes';

export type ProtocolIntellisenseKind =
  | 'terminology'
  | 'synonym'
  | 'knowledgeEntity'
  | 'objective'
  | 'endpoint'
  | 'estimand'
  | 'population'
  | 'intervention'
  | 'arm'
  | 'assessment'
  | 'visit'
  | 'soa'
  | 'phrase'
  | 'ghostText';

export type ProtocolIntellisenseSource =
  | 'm11Terminology'
  | 'knowledgeGraph'
  | 'studyModel'
  | 'soaKnowledge'
  | 'sectionContext'
  | 'protocolEntity'
  | 'localHeuristic';

export type ProtocolIntellisenseTrigger = 'typing' | 'explicit' | 'tab' | 'hover';

export interface ProtocolIntellisenseReplacementRange {
  startOffset: number;
  endOffset: number;
}

export interface ProtocolIntellisenseSuggestion {
  id: string;
  label: string;
  insertText: string;
  detail?: string;
  description?: string;
  kind: ProtocolIntellisenseKind;
  source: ProtocolIntellisenseSource;
  score: number;
  replacementRange?: ProtocolIntellisenseReplacementRange;
  metadata?: Record<string, string>;
}

export interface ProtocolIntellisenseContext {
  sectionId: string;
  sectionTitle?: string;
  currentText: string;
  cursorOffset: number;
  currentToken: string;
  currentLine: string;
  nearbyText: string;
  knowledgeGraph?: KnowledgeGraph | null;
  studyModel?: StudyModel | null;
  soaKnowledge?: SoAKnowledgeModel | null;
  trigger: ProtocolIntellisenseTrigger;
  explicitQuery?: string;
}

export interface ProtocolIntellisenseResult {
  suggestions: ProtocolIntellisenseSuggestion[];
  ghostText: ProtocolIntellisenseSuggestion | null;
}

export interface IntellisenseAcceptanceRecord {
  id: string;
  sectionId: string;
  suggestionId: string;
  kind: ProtocolIntellisenseKind;
  source: ProtocolIntellisenseSource;
  originalText: string;
  insertedText: string;
  timestamp: string;
  metadata?: Record<string, string>;
}
