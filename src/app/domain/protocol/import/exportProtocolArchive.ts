import { getProtocolSnapshot } from '../store/protocolStore';
import { ICH_M11_TERMINOLOGY_META } from '../ichM11/ichM11ControlledTerminology';
import { getProtocolImportState, getImportedProtocolSource } from './protocolImportStore';
import { getProtocolCommits, getCurrentProtocolVersion, APP_SCHEMA_VERSION } from './protocolVersioning';
import { getProtocolKnowledgeModel } from './protocolImportStore';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';

export const M11_STUDIO_ARCHIVE_SCHEMA = 'm11-studio-archive/v1';

export interface M11StudioArchivePayload {
  schema: typeof M11_STUDIO_ARCHIVE_SCHEMA;
  appSchemaVersion: string;
  exportedAt: string;
  protocolDocument: ReturnType<typeof getProtocolSnapshot>;
  import: {
    artifact: ReturnType<typeof getProtocolImportState>['artifact'];
    importedSourceSummary: ReturnType<typeof getProtocolImportState>['importedSourceSummary'];
    sectionDrafts: ReturnType<typeof getProtocolImportState>['sectionDrafts'];
    lastImportCompletedAt: ReturnType<typeof getProtocolImportState>['lastImportCompletedAt'];
    protocolKnowledgeModelId: ReturnType<typeof getProtocolImportState>['protocolKnowledgeModelId'];
  };
  protocolKnowledgeModel: ProtocolKnowledgeModel | null;
  importedSourceExcerpt?: {
    uploadId: string;
    fullTextLength: number;
    sectionCount: number;
  };
  versioning: {
    currentVersion: ReturnType<typeof getCurrentProtocolVersion>;
    commits: ReturnType<typeof getProtocolCommits>;
  };
  referenceDocuments: Array<{ id: string; status: string; filename?: string }>;
  controlledTerminologyMeta: typeof ICH_M11_TERMINOLOGY_META;
}

export async function buildM11StudioArchivePayload(
  referenceDocumentSummaries: Array<{ id: string; status: string; filename?: string }> = [],
): Promise<M11StudioArchivePayload> {
  const importState = getProtocolImportState();
  const protocolId = importState.protocolId;
  const source = getImportedProtocolSource();
  const knowledge: ProtocolKnowledgeModel | null = getProtocolKnowledgeModel();

  return {
    schema: M11_STUDIO_ARCHIVE_SCHEMA,
    appSchemaVersion: APP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    protocolDocument: getProtocolSnapshot(),
    import: {
      artifact: importState.artifact,
      importedSourceSummary: importState.importedSourceSummary,
      sectionDrafts: importState.sectionDrafts,
      lastImportCompletedAt: importState.lastImportCompletedAt,
      protocolKnowledgeModelId: importState.protocolKnowledgeModelId,
    },
    protocolKnowledgeModel: knowledge,
    importedSourceExcerpt: source
      ? {
          uploadId: source.uploadId,
          fullTextLength: source.fullText.length,
          sectionCount: source.sections.length,
        }
      : undefined,
    versioning: {
      currentVersion: getCurrentProtocolVersion(protocolId),
      commits: getProtocolCommits(protocolId),
    },
    referenceDocuments: referenceDocumentSummaries,
    controlledTerminologyMeta: ICH_M11_TERMINOLOGY_META,
  };
}

export async function downloadM11StudioArchive(
  referenceDocumentSummaries: Array<{ id: string; status: string; filename?: string }> = [],
): Promise<void> {
  const payload = await buildM11StudioArchivePayload(referenceDocumentSummaries);
  const protocolId = payload.protocolDocument.id ?? 'protocol';
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${protocolId}-m11-studio-archive.json`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
