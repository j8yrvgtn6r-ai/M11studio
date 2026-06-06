import type { ProtocolDocument } from '../protocol/types';
import type { StudyModel, StudyModelDependency } from './studyModelTypes';

function pushDependency(
  list: StudyModelDependency[],
  dependency: Omit<StudyModelDependency, 'id'>,
  index: number,
): void {
  list.push({ ...dependency, id: `ssm-dep-${index}` });
}

export function buildStudyModelDependencies(
  model: StudyModel,
  document: ProtocolDocument | null,
): StudyModelDependency[] {
  const dependencies: StudyModelDependency[] = [];
  let index = 0;

  for (const item of model.randomization) {
    for (const sectionId of item.sourceSections) {
      pushDependency(
        dependencies,
        {
          kind: 'defines',
          studyModelItemId: item.id,
          protocolSectionId: sectionId,
          dependencyGraphNodeId: document?.clinicalDesign?.arms?.[0]?.id,
          label: item.name,
        },
        index++,
      );
    }
  }

  for (const item of model.objectives) {
    for (const sectionId of item.sourceSections) {
      pushDependency(
        dependencies,
        {
          kind: 'informs',
          studyModelItemId: item.id,
          protocolSectionId: sectionId,
          dependencyGraphNodeId: document?.clinicalDesign?.objectives?.[0]?.id,
          label: item.name,
        },
        index++,
      );
    }
  }

  for (const item of model.endpoints) {
    for (const sectionId of item.sourceSections) {
      pushDependency(
        dependencies,
        {
          kind: 'measured-by',
          studyModelItemId: item.id,
          protocolSectionId: sectionId,
          dependencyGraphNodeId: document?.clinicalDesign?.endpoints?.[0]?.id,
          label: item.name,
        },
        index++,
      );
    }
  }

  for (const item of model.assessments) {
    for (const sectionId of item.sourceSections) {
      pushDependency(
        dependencies,
        {
          kind: 'performed-at',
          studyModelItemId: item.id,
          protocolSectionId: sectionId,
          dependencyGraphNodeId: document?.clinicalDesign?.assessments?.[0]?.id,
          label: item.name,
        },
        index++,
      );
    }
  }

  return dependencies;
}

export function getStudyModelDependenciesForSection(
  dependencies: StudyModelDependency[],
  sectionId: string | null,
): StudyModelDependency[] {
  if (!sectionId) {
    return [];
  }
  return dependencies.filter((dependency) => dependency.protocolSectionId === sectionId);
}

export function getStudyModelDependenciesForItem(
  dependencies: StudyModelDependency[],
  studyModelItemId: string,
): StudyModelDependency[] {
  return dependencies.filter((dependency) => dependency.studyModelItemId === studyModelItemId);
}
