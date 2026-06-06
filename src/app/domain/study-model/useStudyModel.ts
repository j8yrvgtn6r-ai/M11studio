import { useSyncExternalStore } from 'react';

import {
  getStudyModel,
  getStudyModelDependencies,
  getStudyModelPhase,
  subscribeStudyModel,
} from './studyModelStore';

export function useStudyModel() {
  const model = useSyncExternalStore(subscribeStudyModel, getStudyModel, getStudyModel);
  const dependencies = useSyncExternalStore(
    subscribeStudyModel,
    getStudyModelDependencies,
    getStudyModelDependencies,
  );
  const phase = useSyncExternalStore(subscribeStudyModel, getStudyModelPhase, getStudyModelPhase);
  return { model, dependencies, phase };
}
