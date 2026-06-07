export type {
  IntellisenseAcceptanceRecord,
  ProtocolIntellisenseContext,
  ProtocolIntellisenseKind,
  ProtocolIntellisenseReplacementRange,
  ProtocolIntellisenseResult,
  ProtocolIntellisenseSource,
  ProtocolIntellisenseSuggestion,
  ProtocolIntellisenseTrigger,
} from './intellisenseTypes';

export {
  applyIntellisenseSuggestion,
  buildProtocolIntellisenseContext,
  findIntellisenseSuggestionForFix,
  getProtocolIntellisenseSuggestions,
} from './intellisenseProvider';
export type { BuildIntellisenseContextInput } from './intellisenseProvider';

export { rankAndDedupeIntellisenseSuggestions, rankIntellisenseSuggestion } from './intellisenseRanking';
export { terminologyCompletionProvider } from './terminologyCompletionProvider';
export { knowledgeGraphCompletionProvider } from './knowledgeGraphCompletionProvider';
export { sectionContextCompletionProvider, getSectionContextBoost } from './sectionContextCompletionProvider';
export { ghostTextProvider, selectGhostTextSuggestion } from './ghostTextProvider';
export {
  applyRangeReplacement,
  getLineAtOffset,
  getNearbyText,
  getPhraseRangeAtOffset,
  getTokenRangeAtOffset,
  lineNumberFromOffset,
} from './textRange';
export type { TextRange } from './textRange';
export {
  clearIntellisenseAcceptanceRecords,
  listIntellisenseAcceptanceRecords,
  recordIntellisenseAcceptance,
  reloadIntellisenseAcceptanceRecordsFromStorage,
  subscribeIntellisenseAcceptanceRecords,
} from './intellisenseAcceptanceStore';
