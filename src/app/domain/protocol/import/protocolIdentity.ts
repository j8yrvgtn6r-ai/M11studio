import { getStudyModel } from '../../study-model/studyModelStore';
import { getProtocolDocument, isBlankProjectMode } from '../store/protocolStore';
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
  const sponsorId = getProtocolDocument()
    .elements.find((element) => element.id === 'title_page.sponsor_protocol_identifier')
    ?.value?.toString()
    .trim();
  const fullTitle = getProtocolDocument()
    .elements.find((element) => element.id === 'title_page.full_title')
    ?.value?.toString()
    .trim();
  if (sponsorId) {
    return sponsorId;
  }
  if (fullTitle) {
    return fullTitle.length > 48 ? `${fullTitle.slice(0, 45)}…` : fullTitle;
  }
  if (options.fallbackProtocolId?.trim() && !isBlankProjectMode()) {
    return options.fallbackProtocolId.trim();
  }
  return 'No Project';
}
