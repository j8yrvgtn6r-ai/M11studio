/** Git-friendly protocol asset reference (no embedded binary in section text). */
export type ProtocolAssetType = 'figure' | 'table-image' | 'diagram' | 'attachment';

export interface ProtocolAssetReference {
  id: string;
  type: ProtocolAssetType;
  name: string;
  caption: string;
  storageLocation: string;
  createdAt: string;
}

export interface ParsedImageReference {
  caption: string;
  assetId?: string;
}

export function createProtocolAssetReference(
  input: Pick<ProtocolAssetReference, 'name' | 'caption' | 'type'> & { storageLocation?: string; id?: string },
): ProtocolAssetReference {
  const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: input.id ?? `asset.${slug || 'reference'}.${Date.now()}`,
    type: input.type,
    name: input.name.trim(),
    caption: input.caption.trim() || input.name.trim(),
    storageLocation: input.storageLocation ?? `protocol-assets/${slug || 'reference'}`,
    createdAt: new Date().toISOString(),
  };
}

/** Inserts a markdown-style figure reference token into narrative text. */
export function formatImageReferenceToken(reference: Pick<ProtocolAssetReference, 'caption' | 'id'>): string {
  return `[Figure: ${reference.caption}](asset:${reference.id})`;
}

export function parseImageReferenceToken(text: string): ParsedImageReference | null {
  const richMatch = text.match(/\[Figure:\s*([^\]|]+)(?:\]\(asset:([^)]+)\))?/);
  if (richMatch) {
    return {
      caption: richMatch[1]?.trim() ?? '',
      assetId: richMatch[2]?.trim(),
    };
  }
  const simpleMatch = text.match(/\[Figure:\s*([^\]]+)\]/);
  if (!simpleMatch?.[1]) {
    return null;
  }
  return { caption: simpleMatch[1].trim() };
}

export function extractFigureReferenceTokens(text: string): string[] {
  const matches = text.match(/\[Figure:[^\]]+\](?:\(asset:[^)]+\))?/g);
  return matches ?? [];
}
