import { getProtocolSnapshot } from '../store';
import type { ProtocolDocument } from '../types';

/** Serializes a protocol document as indented JSON. */
export function serializeProtocolDocument(document: ProtocolDocument = getProtocolSnapshot()): string {
  return JSON.stringify(document, null, 2);
}

/** Builds a download filename from the protocol id. */
export function getProtocolExportFilename(document: ProtocolDocument = getProtocolSnapshot()): string {
  return `${document.id}.json`;
}

/** Downloads the current protocol store snapshot as a JSON file. */
export function downloadProtocolJson(): void {
  const snapshot = getProtocolSnapshot();
  const json = serializeProtocolDocument(snapshot);
  const filename = getProtocolExportFilename(snapshot);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
