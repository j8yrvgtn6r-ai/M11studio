import type { StudyModelCollectionKey } from '../../../study-model/studyModelTypes';
import type { ProtocolIntellisenseContext, ProtocolIntellisenseKind, ProtocolIntellisenseSuggestion } from './intellisenseTypes';
import { getTokenRangeAtOffset } from './textRange';

interface SectionContextProfile {
  sectionIds: string[];
  titlePatterns: RegExp[];
  kinds: ProtocolIntellisenseKind[];
  phrases: string[];
  studyModelCollections: StudyModelCollectionKey[];
  boost: number;
}

const SECTION_PROFILES: SectionContextProfile[] = [
  {
    sectionIds: ['3'],
    titlePatterns: [/objective/i, /endpoint/i, /estimand/i],
    kinds: ['objective', 'endpoint', 'estimand', 'population'],
    phrases: ['primary objective', 'secondary objective', 'primary endpoint', 'key secondary endpoint', 'estimand'],
    studyModelCollections: ['objectives', 'endpoints', 'estimands', 'population'],
    boost: 12,
  },
  {
    sectionIds: ['4'],
    titlePatterns: [/design/i, /random/i, /blind/i],
    kinds: ['arm', 'intervention', 'phrase'],
    phrases: ['randomization', 'blinding', 'intervention model', 'trial design', 'control arm'],
    studyModelCollections: ['arms', 'randomization', 'blinding', 'elements'],
    boost: 12,
  },
  {
    sectionIds: ['5'],
    titlePatterns: [/population/i, /eligibility/i, /inclusion/i],
    kinds: ['population', 'phrase'],
    phrases: ['inclusion criteria', 'exclusion criteria', 'trial population', 'enrolled participants'],
    studyModelCollections: ['population', 'eligibility'],
    boost: 12,
  },
  {
    sectionIds: ['6'],
    titlePatterns: [/intervention/i, /dosing/i, /concomitant/i],
    kinds: ['intervention', 'phrase'],
    phrases: ['investigational trial intervention', 'dose regimen', 'administration', 'concomitant therapy'],
    studyModelCollections: ['interventions'],
    boost: 12,
  },
  {
    sectionIds: ['8'],
    titlePatterns: [/assessment/i, /procedure/i, /schedule of activities/i, /soa/i],
    kinds: ['assessment', 'visit', 'soa', 'phrase'],
    phrases: ['schedule of activities', 'study assessment', 'study procedure', 'visit window'],
    studyModelCollections: ['assessments', 'activities', 'visits', 'procedures'],
    boost: 14,
  },
  {
    sectionIds: ['9'],
    titlePatterns: [/adverse event/i, /safety/i],
    kinds: ['phrase'],
    phrases: ['adverse event', 'serious adverse event', 'safety monitoring', 'safety reporting'],
    studyModelCollections: ['safetyMonitoring'],
    boost: 12,
  },
  {
    sectionIds: ['10'],
    titlePatterns: [/statistical/i, /sample size/i, /analysis/i],
    kinds: ['endpoint', 'estimand', 'phrase'],
    phrases: ['primary analysis', 'analysis set', 'statistical method', 'sample size', 'multiplicity adjustment'],
    studyModelCollections: ['statisticalMethods', 'endpoints', 'estimands'],
    boost: 14,
  },
];

function resolveSectionProfiles(context: ProtocolIntellisenseContext): SectionContextProfile[] {
  const title = context.sectionTitle ?? '';
  return SECTION_PROFILES.filter(
    (profile) =>
      profile.sectionIds.includes(context.sectionId) ||
      profile.titlePatterns.some((pattern) => pattern.test(title)),
  );
}

export function sectionContextCompletionProvider(
  context: ProtocolIntellisenseContext,
): ProtocolIntellisenseSuggestion[] {
  const query = (context.explicitQuery ?? context.currentToken).trim().toLowerCase();
  if (query.length < 2) {
    return [];
  }

  const profiles = resolveSectionProfiles(context);
  if (profiles.length === 0) {
    return [];
  }

  const tokenRange = getTokenRangeAtOffset(context.currentText, context.cursorOffset);
  const suggestions: ProtocolIntellisenseSuggestion[] = [];
  const seen = new Set<string>();

  for (const profile of profiles) {
    for (const phrase of profile.phrases) {
      if (!phrase.toLowerCase().includes(query) && !query.startsWith(phrase.slice(0, Math.min(query.length, 4)).toLowerCase())) {
        continue;
      }
      if (seen.has(phrase.toLowerCase())) {
        continue;
      }
      seen.add(phrase.toLowerCase());
      suggestions.push({
        id: `section.${context.sectionId}.${phrase}`,
        label: phrase,
        insertText: phrase,
        detail: `Section ${context.sectionId} context`,
        description: `Suggested phrasing for ${context.sectionTitle ?? `section ${context.sectionId}`}`,
        kind: profile.kinds[0] ?? 'phrase',
        source: 'sectionContext',
        score: profile.boost + (phrase.toLowerCase().startsWith(query) ? 8 : 4),
        replacementRange: tokenRange
          ? { startOffset: tokenRange.startOffset, endOffset: tokenRange.endOffset }
          : undefined,
        metadata: { sectionId: context.sectionId },
      });
    }

    const model = context.studyModel;
    if (model) {
      for (const collectionKey of profile.studyModelCollections) {
        for (const item of model[collectionKey]) {
          if (!item.name.toLowerCase().includes(query)) {
            continue;
          }
          const key = `${collectionKey}:${item.name.toLowerCase()}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          suggestions.push({
            id: `study.${collectionKey}.${item.id}`,
            label: item.name,
            insertText: item.name,
            detail: collectionKey,
            description: item.description,
            kind: profile.kinds.includes('endpoint') && collectionKey === 'endpoints'
              ? 'endpoint'
              : profile.kinds.includes('assessment') && collectionKey === 'assessments'
                ? 'assessment'
                : 'phrase',
            source: 'studyModel',
            score: profile.boost + 6,
            replacementRange: tokenRange
              ? { startOffset: tokenRange.startOffset, endOffset: tokenRange.endOffset }
              : undefined,
            metadata: { collectionKey, itemId: item.id },
          });
        }
      }
    }
  }

  return suggestions;
}

export function getSectionContextBoost(context: ProtocolIntellisenseContext, kind: ProtocolIntellisenseKind): number {
  const profiles = resolveSectionProfiles(context);
  if (profiles.length === 0) {
    return 0;
  }
  return profiles.some((profile) => profile.kinds.includes(kind)) ? profiles[0].boost : 0;
}
