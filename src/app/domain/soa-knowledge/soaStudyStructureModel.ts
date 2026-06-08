/**
 * OpenStudyBuilder-inspired study structure hierarchy for SoA Builder v1.
 *
 * Study Structure
 * → Epochs → Arms → Elements → Visits → Activities / Assessments
 * → Schedule Rules → Milestones → Conditional Logic
 */

import type { SoAEntityEditorKind } from './soaEntityValidation';

export const SOA_BUILDER_STRUCTURE_LAYERS = [
  'studyStructure',
  'epochs',
  'arms',
  'elements',
  'visits',
  'activities',
  'assessments',
  'scheduleRules',
  'milestones',
  'conditionalLogic',
] as const;

export type SoABuilderStructureLayer = (typeof SOA_BUILDER_STRUCTURE_LAYERS)[number];

export const SOA_BUILDER_NARRATIVE_SECTIONS = ['1.3', '4', '6', '8', '9', '10'] as const;

export type SoABuilderNarrativeSectionId = (typeof SOA_BUILDER_NARRATIVE_SECTIONS)[number];

export interface SoABuilderLayerDefinition {
  layer: SoABuilderStructureLayer;
  label: string;
  description: string;
  entityKind?: SoAEntityEditorKind | 'milestone';
  parentLayer?: SoABuilderStructureLayer;
}

export const SOA_BUILDER_LAYER_DEFINITIONS: SoABuilderLayerDefinition[] = [
  {
    layer: 'epochs',
    label: 'Epochs',
    description: 'Study epochs sequence the trial timeline (screening, treatment, follow-up).',
    entityKind: 'epoch',
    parentLayer: 'studyStructure',
  },
  {
    layer: 'arms',
    label: 'Arms',
    description: 'Treatment arms and intervention assignments.',
    entityKind: 'arm',
    parentLayer: 'epochs',
  },
  {
    layer: 'elements',
    label: 'Elements',
    description: 'Design elements map arms to epochs with planned duration.',
    entityKind: 'element',
    parentLayer: 'arms',
  },
  {
    layer: 'visits',
    label: 'Visits',
    description: 'Operational visits anchored to milestones with timing windows.',
    entityKind: 'visit',
    parentLayer: 'elements',
  },
  {
    layer: 'activities',
    label: 'Activities',
    description: 'On-treatment activities performed at visits.',
    entityKind: 'activity',
    parentLayer: 'visits',
  },
  {
    layer: 'assessments',
    label: 'Assessments',
    description: 'Assessment catalog rows linked to activities and visits.',
    entityKind: 'assessment',
    parentLayer: 'activities',
  },
  {
    layer: 'scheduleRules',
    label: 'Schedule Rules',
    description: 'Assessment × visit intersections with optional conditions.',
    entityKind: 'scheduleRule',
    parentLayer: 'assessments',
  },
  {
    layer: 'milestones',
    label: 'Milestones',
    description: 'Anchor events and dates that position visits on the timeline.',
    entityKind: 'milestone',
    parentLayer: 'visits',
  },
  {
    layer: 'conditionalLogic',
    label: 'Conditional Logic',
    description: 'Decision rules that gate assessments, activities, and schedule rules.',
    entityKind: 'condition',
    parentLayer: 'scheduleRules',
  },
];

/** Bidirectional sync targets for SoA Builder edits. */
export const SOA_BUILDER_SYNC_TARGETS = [
  'protocolNarrative',
  'knowledgeGraph',
  'soaKnowledge',
  'soaConfiguration',
  'futureUsdmJson',
] as const;

export type SoABuilderSyncTarget = (typeof SOA_BUILDER_SYNC_TARGETS)[number];
