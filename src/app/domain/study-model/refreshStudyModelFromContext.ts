import { getImportedProtocolSource, getProtocolKnowledgeModel } from '../protocol/import/protocolImportStore';
import { getProtocolDocument } from '../protocol/store/protocolStore';
import { getStudyModel, rebuildStudyModel } from './studyModelStore';

/** Rebuilds the SSM when import context or protocol document changes. */
export function refreshStudyModelFromContext(): void {
  const knowledge = getProtocolKnowledgeModel();
  const source = getImportedProtocolSource();
  if (!knowledge && !source && !getStudyModel()) {
    return;
  }

  rebuildStudyModel({
    sourceUploadId: source?.uploadId ?? knowledge?.id ?? 'protocol',
    knowledge,
    document: getProtocolDocument(),
  });
}
