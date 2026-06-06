/**
 * Coerces unknown values to arrays for safe `.filter` / `.map` usage.
 * Strings become single-element arrays; null/undefined become [].
 */
export function ensureArray<T>(value: unknown): T[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? ([trimmed] as T[]) : [];
  }
  return [];
}
