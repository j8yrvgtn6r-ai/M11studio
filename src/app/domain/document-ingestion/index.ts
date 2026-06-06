export type {
  BuildCanonicalDocumentInput,
  CanonicalBlock,
  CanonicalBlockType,
  CanonicalBuildProgressEvent,
  CanonicalDocument,
  CanonicalDocumentStatistics,
  CanonicalSourceFormat,
  CanonicalSourceSection,
  SectionSimilarityResult,
} from './canonicalDocumentTypes';

export {
  buildCanonicalDocument,
  buildCanonicalDocumentFromImportedSource,
} from './canonicalDocumentBuilder';

export {
  blockClassificationWarnings,
  calculateSectionSimilarity,
  findBestM11SimilarityMatches,
  summarizeCanonicalDocumentDiagnostics,
} from './canonicalDocumentDiagnostics';

export {
  clearCanonicalDocuments,
  getCanonicalDocument,
  getCanonicalDocumentByUploadId,
  listCachedCanonicalDocumentIds,
  saveCanonicalDocument,
} from './canonicalDocumentStore';

export {
  canonicalSectionsToSourceCandidates,
  selectBestSimilarityForM11Section,
  selectCanonicalSectionById,
  selectCanonicalSectionForSourceCandidate,
  selectDocumentStatisticsSummary,
} from './canonicalDocumentSelectors';
