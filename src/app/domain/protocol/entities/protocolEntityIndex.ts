import type { ProtocolEntity, ProtocolEntityRegistry } from './protocolEntityTypes';

export interface ProtocolEntitySearchIndex {
  byId: Map<string, ProtocolEntity>;
  byNormalizedPrefix: Map<string, ProtocolEntity[]>;
}

function prefixKey(value: string, length = 3): string {
  return value.slice(0, Math.max(2, length));
}

export function buildProtocolEntityIndex(registry: ProtocolEntityRegistry): ProtocolEntitySearchIndex {
  const byId = new Map<string, ProtocolEntity>();
  const byNormalizedPrefix = new Map<string, ProtocolEntity[]>();

  for (const entity of registry.entities) {
    byId.set(entity.id, entity);
    const keys = new Set<string>([
      prefixKey(entity.normalizedName),
      prefixKey(entity.normalizedName, 4),
    ]);
    for (const alias of entity.aliases) {
      keys.add(prefixKey(alias.toLowerCase()));
    }
    for (const key of keys) {
      const bucket = byNormalizedPrefix.get(key) ?? [];
      bucket.push(entity);
      byNormalizedPrefix.set(key, bucket);
    }
  }

  return { byId, byNormalizedPrefix };
}

export function searchProtocolEntityIndex(
  index: ProtocolEntitySearchIndex,
  query: string,
): ProtocolEntity[] {
  const normalized = query.toLowerCase().trim();
  if (normalized.length < 2) {
    return [];
  }

  const prefixMatches = index.byNormalizedPrefix.get(prefixKey(normalized)) ?? [];
  const directMatches = [...index.byId.values()].filter((entity) => {
    if (entity.normalizedName.includes(normalized)) {
      return true;
    }
    return entity.aliases.some((alias) => alias.toLowerCase().includes(normalized));
  });

  const merged = new Map<string, ProtocolEntity>();
  for (const entity of [...prefixMatches, ...directMatches]) {
    merged.set(entity.id, entity);
  }
  return [...merged.values()];
}
