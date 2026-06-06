import type { ProtocolKnowledgeModel } from '../protocol/import/protocolKnowledgeTypes';
import type { ProtocolDocument } from '../protocol/types';
import { buildStudyModelFromSources } from './studyModelBuilder';
import type { StudyModel, StudyModelDependency } from './studyModelTypes';
import { buildStudyModelDependencies } from './studyModelDependencyMap';

export type StudyModelPhase = 'idle' | 'core' | 'enriching' | 'deep';

const listeners = new Set<() => void>();

let studyModel: StudyModel | null = null;
let dependencies: StudyModelDependency[] = [];
let studyModelPhase: StudyModelPhase = 'idle';

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeStudyModel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStudyModel(): StudyModel | null {
  return studyModel;
}

export function getStudyModelDependencies(): StudyModelDependency[] {
  return dependencies;
}

export function getStudyModelPhase(): StudyModelPhase {
  return studyModelPhase;
}

export function setStudyModelPhase(phase: StudyModelPhase): void {
  studyModelPhase = phase;
  notify();
}

export function rebuildStudyModel(input: {
  sourceUploadId: string;
  knowledge?: ProtocolKnowledgeModel | null;
  document?: ProtocolDocument | null;
}): StudyModel {
  studyModel = buildStudyModelFromSources(input);
  dependencies = buildStudyModelDependencies(studyModel, input.document ?? null);
  notify();
  return studyModel;
}

export function clearStudyModel(): void {
  studyModel = null;
  dependencies = [];
  studyModelPhase = 'idle';
  notify();
}
