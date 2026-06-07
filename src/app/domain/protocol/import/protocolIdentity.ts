import { getStudyModel } from '../../study-model/studyModelStore';
import type { ImportedProtocolSourceSummary } from './types';
import { getProtocolKnowledgeModel } from './protocolImportStore';

export function resolveProtocolDisplayIdentity(options: {
  importedSourceSummary?: ImportedProtocolSourceSummary | null;
  fallbackProtocolId?: string | null;
}): string {
  const studyModel = getStudyModel();
  const knowledge = getProtocolKnowledgeModel();
  const fromStudyModel =
    studyModel?.protocolIdentifier?.trim() ||
    studyModel?.title?.trim() ||
    knowledge?.protocolIdentifier?.trim();
  if (fromStudyModel) {
    return fromStudyModel;
  }
  const importedTitle = options.importedSourceSummary?.filename?.replace(/\.docx$/i, '').trim();
  if (importedTitle) {
    return importedTitle;
  }
  if (options.fallbackProtocolId?.trim()) {
    return options.fallbackProtocolId.trim();
  }
  return 'Untitled protocol';
}
