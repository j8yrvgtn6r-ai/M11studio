export const LLM_TIMEOUT_MS = {
  healthCheck: 30_000,
  protocolUnderstanding: 120_000,
  sectionGeneration: 120_000,
  sectionRegeneration: 120_000,
} as const;

export type LlmRequestOperation = keyof typeof LLM_TIMEOUT_MS;

const OPERATION_LABELS: Record<LlmRequestOperation, string> = {
  healthCheck: 'connection test',
  protocolUnderstanding: 'protocol understanding',
  sectionGeneration: 'M11 section generation',
  sectionRegeneration: 'M11 section regeneration',
};

export class LlmRequestTimeoutError extends Error {
  readonly operation: LlmRequestOperation;
  readonly timeoutMs: number;

  constructor(operation: LlmRequestOperation, timeoutMs: number) {
    super(
      `The ${OPERATION_LABELS[operation]} request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again or cancel.`,
    );
    this.name = 'LlmRequestTimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export class ImportProcessingAbortedError extends Error {
  constructor() {
    super('Import cancelled.');
    this.name = 'ImportProcessingAbortedError';
  }
}

export function resolveLlmTimeoutMs(operation: LlmRequestOperation): number {
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem(`m11-test-llm-timeout-${operation}`);
    if (override !== null && override !== '') {
      const parsed = Number(override);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }
  return LLM_TIMEOUT_MS[operation];
}

export function shouldSimulateLlmTimeout(operation: LlmRequestOperation): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem('m11-smoke-simulate-llm-timeout') === operation;
}

function linkAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export async function fetchWithLlmTimeout(
  url: string,
  init: RequestInit,
  operation: LlmRequestOperation,
  timeoutMs = resolveLlmTimeoutMs(operation),
): Promise<Response> {
  if (shouldSimulateLlmTimeout(operation)) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    throw new LlmRequestTimeoutError(operation, timeoutMs);
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new LlmRequestTimeoutError(operation, timeoutMs)), timeoutMs);
  const combinedSignal = init.signal
    ? linkAbortSignals([init.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    return await fetch(url, { ...init, signal: combinedSignal });
  } catch (error) {
    if (error instanceof LlmRequestTimeoutError) {
      throw error;
    }
    if (init.signal?.aborted) {
      throw new ImportProcessingAbortedError();
    }
    if (timeoutController.signal.aborted) {
      throw new LlmRequestTimeoutError(operation, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ImportProcessingAbortedError();
  }
}

export function formatLlmUserError(error: unknown): string {
  if (error instanceof ImportProcessingAbortedError) {
    return error.message;
  }
  if (error instanceof LlmRequestTimeoutError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Request failed.';
}
