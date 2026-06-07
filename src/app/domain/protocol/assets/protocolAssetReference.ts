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

export function createProtocolAssetReference(
  input: Pick<ProtocolAssetReference, 'name' | 'caption' | 'type'> & { storageLocation?: string },
): ProtocolAssetReference {
  const slug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: `asset.${slug || 'reference'}.${Date.now()}`,
    type: input.type,
    name: input.name.trim(),
    caption: input.caption.trim() || input.name.trim(),
    storageLocation: input.storageLocation ?? `protocol-assets/${slug || 'reference'}`,
    createdAt: new Date().toISOString(),
  };
}

/** Inserts a markdown-style figure reference token into narrative text. */
export function formatImageReferenceToken(reference: ProtocolAssetReference): string {
  return `[Figure: ${reference.caption}]`;
}

export function parseImageReferenceToken(text: string): string | null {
  const match = text.match(/\[Figure:\s*([^\]]+)\]/);
  return match?.[1]?.trim() ?? null;
}
