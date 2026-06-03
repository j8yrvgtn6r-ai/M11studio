function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isDate(value);
}

export interface DeepEqualDifference {
  path: string;
  expected: unknown;
  actual: unknown;
}

export function deepEqual(
  expected: unknown,
  actual: unknown,
  path = 'root'
): DeepEqualDifference[] {
  if (isDate(expected) && isDate(actual)) {
    return expected.getTime() === actual.getTime()
      ? []
      : [{ path, expected: expected.toISOString(), actual: actual.toISOString() }];
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return [{ path: `${path}.length`, expected: expected.length, actual: actual.length }];
    }

    return expected.flatMap((expectedItem, index) =>
      deepEqual(expectedItem, actual[index], `${path}[${index}]`)
    );
  }

  if (isPlainObject(expected) && isPlainObject(actual)) {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    const differences: DeepEqualDifference[] = [];

    for (const key of expectedKeys) {
      if (!(key in actual)) {
        differences.push({ path: `${path}.${key}`, expected: expected[key], actual: undefined });
      }
    }

    for (const key of actualKeys) {
      if (!(key in expected)) {
        differences.push({ path: `${path}.${key}`, expected: undefined, actual: actual[key] });
      }
    }

    for (const key of expectedKeys) {
      if (key in actual) {
        differences.push(...deepEqual(expected[key], actual[key], `${path}.${key}`));
      }
    }

    return differences;
  }

  if (expected !== actual) {
    return [{ path, expected, actual }];
  }

  return [];
}

export function formatDifferences(differences: DeepEqualDifference[]): string {
  if (differences.length === 0) {
    return '';
  }

  return differences
    .map(
      (difference) =>
        `  - ${difference.path}\n    expected: ${JSON.stringify(difference.expected)}\n    actual:   ${JSON.stringify(difference.actual)}`
    )
    .join('\n');
}
