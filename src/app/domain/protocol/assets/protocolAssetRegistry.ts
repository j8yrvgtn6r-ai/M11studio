/** Local persisted asset registry for Protocol IDE figure/image references. */

export type ProtocolRegistryAssetType = 'image' | 'figure' | 'table' | 'other';

export type ProtocolRegistryAssetSource = 'uploaded' | 'imported' | 'url' | 'generated';

export interface ProtocolRegistryAsset {
  id: string;
  type: ProtocolRegistryAssetType;
  name: string;
  caption: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  url?: string;
  source: ProtocolRegistryAssetSource;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

const STORAGE_KEY = 'm11-protocol-assets-v1';

type AssetListener = (assets: ProtocolRegistryAsset[]) => void;

let assets: ProtocolRegistryAsset[] = loadAssets();
const listeners = new Set<AssetListener>();

function loadAssets(): ProtocolRegistryAsset[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ProtocolRegistryAsset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistAssets(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  for (const listener of listeners) {
    listener([...assets]);
  }
}

export function listAssets(): ProtocolRegistryAsset[] {
  return [...assets];
}

export function getAsset(id: string): ProtocolRegistryAsset | null {
  return assets.find((asset) => asset.id === id) ?? null;
}

export function findAssetByCaption(caption: string): ProtocolRegistryAsset | null {
  const normalized = caption.trim().toLowerCase();
  return assets.find((asset) => asset.caption.trim().toLowerCase() === normalized) ?? null;
}

export function addAsset(
  input: Omit<ProtocolRegistryAsset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): ProtocolRegistryAsset {
  const now = new Date().toISOString();
  const asset: ProtocolRegistryAsset = {
    ...input,
    id: input.id ?? `asset.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  assets = [...assets, asset];
  persistAssets();
  return asset;
}

export function updateAsset(id: string, patch: Partial<Omit<ProtocolRegistryAsset, 'id' | 'createdAt'>>): ProtocolRegistryAsset | null {
  const index = assets.findIndex((asset) => asset.id === id);
  if (index === -1) {
    return null;
  }
  const updated: ProtocolRegistryAsset = {
    ...assets[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  assets = [...assets.slice(0, index), updated, ...assets.slice(index + 1)];
  persistAssets();
  return updated;
}

export function removeAsset(id: string): boolean {
  const before = assets.length;
  assets = assets.filter((asset) => asset.id !== id);
  if (assets.length === before) {
    return false;
  }
  persistAssets();
  return true;
}

/** Clears all assets — used by resetProject(). */
export function clearAssets(): void {
  assets = [];
  persistAssets();
}

/** Removes only imported/source-derived assets; preserves user-created entries. */
export function clearImportedAssets(): void {
  assets = assets.filter((asset) => asset.source !== 'imported');
  persistAssets();
}

export function subscribeAssets(listener: AssetListener): () => void {
  listeners.add(listener);
  listener([...assets]);
  return () => listeners.delete(listener);
}

/** Test helper — reload from storage or reset memory state. */
export function reloadAssetRegistryFromStorage(): void {
  assets = loadAssets();
}
