import { toLegacyDate } from '../selectors/toCollaboration';

/** Serializes a Date for parity fixtures using legacy local-time semantics. */
export function toFixtureTimestamp(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Restores a fixture timestamp string to the selector Date representation. */
export function fromFixtureTimestamp(timestamp: string): Date {
  return toLegacyDate(timestamp);
}

function normalizeForFixture(value: unknown): unknown {
  if (value instanceof Date) {
    return toFixtureTimestamp(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForFixture);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, normalizeForFixture(entryValue)])
    );
  }

  return value;
}

export function stringifyParityFixture(value: unknown): string {
  return `${JSON.stringify(normalizeForFixture(value), null, 2)}\n`;
}
