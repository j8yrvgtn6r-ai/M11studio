import { getProtocolImportState, getImportedProtocolSource, getProtocolKnowledgeModel } from './protocolImportStore';
import type { ImportContextPhase } from './types';

const PRIORITY_READY_PHASES: ImportContextPhase[] = ['core-ready', 'enriching', 'ready'];

export interface ImportGenerationContextDiagnostics {
  ready: boolean;
  phase: ImportContextPhase;
  missing: string[];
}

export class ImportGenerationContextNotReadyError extends Error {
  readonly diagnostics: ImportGenerationContextDiagnostics;

  constructor(diagnostics: ImportGenerationContextDiagnostics) {
    super(
      diagnostics.missing.length > 0
        ? `Import generation context not ready. Missing: ${diagnostics.missing.join(', ')}`
        : 'Import generation context not ready.',
    );
    this.name = 'ImportGenerationContextNotReadyError';
    this.diagnostics = diagnostics;
  }
}

function collectBaseMissing(missing: string[]): void {
  const state = getProtocolImportState();

  if (!state.artifact) {
    missing.push('artifact');
  }
  if (!state.importedSourceSummary?.uploadId) {
    missing.push('importedSourceSummary.uploadId');
  }
  if (!getImportedProtocolSource()) {
    missing.push('sourceExtraction');
  }
  if (!state.protocolKnowledgeModelId) {
    missing.push('protocolKnowledgeModelId');
  }
  if (!getProtocolKnowledgeModel()) {
    missing.push('protocolKnowledgeModel');
  }
}

export function getPriorityGenerationContextDiagnostics(): ImportGenerationContextDiagnostics {
  const state = getProtocolImportState();
  const missing: string[] = [];
  collectBaseMissing(missing);

  const phase = state.importContextPhase ?? 'idle';
  if (!PRIORITY_READY_PHASES.includes(phase)) {
    missing.push(`importContextPhase(${phase})`);
  }

  return {
    ready: missing.length === 0,
    phase,
    missing,
  };
}

export function getImportGenerationContextDiagnostics(): ImportGenerationContextDiagnostics {
  const state = getProtocolImportState();
  const missing: string[] = [];
  collectBaseMissing(missing);

  if (state.importContextPhase !== 'ready') {
    missing.push(`importContextPhase(${state.importContextPhase ?? 'idle'})`);
  }

  return {
    ready: missing.length === 0,
    phase: state.importContextPhase ?? 'idle',
    missing,
  };
}

export function isPriorityGenerationContextReady(): boolean {
  return getPriorityGenerationContextDiagnostics().ready;
}

export function isImportGenerationContextReady(): boolean {
  return getImportGenerationContextDiagnostics().ready;
}

export function assertPriorityGenerationContextReady(operation: string): void {
  const diagnostics = getPriorityGenerationContextDiagnostics();
  if (!diagnostics.ready) {
    console.warn(`[import-generation] ${operation} blocked — missing context:`, diagnostics.missing.join(', '));
    throw new ImportGenerationContextNotReadyError(diagnostics);
  }
}

export function assertImportGenerationContextReady(operation: string): void {
  const diagnostics = getImportGenerationContextDiagnostics();
  if (!diagnostics.ready) {
    console.warn(`[import-generation] ${operation} blocked — missing context:`, diagnostics.missing.join(', '));
    throw new ImportGenerationContextNotReadyError(diagnostics);
  }
}

export function logImportGenerationContextGap(operation: string): ImportGenerationContextDiagnostics {
  const diagnostics = getPriorityGenerationContextDiagnostics();
  console.warn(`[import-generation] ${operation} unavailable — missing context:`, diagnostics.missing.join(', '));
  return diagnostics;
}
