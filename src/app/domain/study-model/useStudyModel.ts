import { useSyncExternalStore } from 'react';

import { getStudyModel, getStudyModelDependencies, subscribeStudyModel } from './studyModelStore';

export function useStudyModel() {
  const model = useSyncExternalStore(subscribeStudyModel, getStudyModel, getStudyModel);
  const dependencies = useSyncExternalStore(
    subscribeStudyModel,
    getStudyModelDependencies,
    getStudyModelDependencies,
  );
  return { model, dependencies };
}
