import { getProtocolDocument } from '../../protocol/store/protocolStore';
import { getProtocolImportState } from '../../protocol/import/protocolImportStore';
import { hasSubstantiveEditorContent } from '../../protocol/authoring/richTextContent';
import { getStudyDesign } from '../StudyDesignStore';
import type {
  StudyDesign,
  StudyDesignActivity,
  StudyDesignEpoch,
  StudyDesignMilestone,
  StudyDesignNarrativeSectionId,
  StudyDesignScheduleAnchor,
  StudyDesignSyncItem,
  StudyDesignSyncProposal,
  StudyDesignVisit,
} from '../StudyDesignTypes';
import { STUDY_DESIGN_NARRATIVE_SECTION_IDS } from '../StudyDesignTypes';
import { createEmptyStudyDesign } from '../StudyDesignStore';

function slugId(prefix: string, name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  return `narrative-${prefix}-${slug}`;
}

function now(): string {
  return new Date().toISOString();
}

function provenance(sectionId: string) {
  const timestamp = now();
  return { source: 'protocolNarrative' as const, createdAt: timestamp, updatedAt: timestamp };
}

export function collectNarrativeSectionText(sectionId: string): string {
  const document = getProtocolDocument();
  const draft = getProtocolImportState().sectionDrafts[sectionId];
  const draftText =
    draft?.validatedTargetText?.trim() ||
    draft?.generatedText?.trim() ||
    draft?.sourceText?.trim() ||
    '';
  const manualText = (document.elements ?? [])
    .filter((element) => element.sectionId === sectionId || element.sectionId?.startsWith(`${sectionId}.`))
    .map((element) => String(element.value ?? ''))
    .join('\n');
  return draftText || manualText;
}

function syncItem(
  kind: StudyDesignSyncItem['kind'],
  id: string,
  name: string,
  sectionId: string,
  reason: string,
): StudyDesignSyncItem {
  return { kind, id, name, source: 'protocolNarrative', sectionId, reason };
}

function extractVisitsFromText(text: string, sectionId: string): StudyDesignVisit[] {
  const pattern =
    /\b(every\s+\d+\s+weeks?|cycle\s*\d+\s*day\s*\d+|day\s*\d+|week\s*\d+|visit\s*\d+[a-z]?|screening|baseline|randomization|follow[- ]?up)\b/gi;
  const visits: StudyDesignVisit[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const name = match[0].replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    visits.push({
      id: slugId('visit', name),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      visitClass: 'scheduled',
      provenance: provenance(sectionId),
    });
  }
  const intervalMatch = text.match(/every\s+(\d+)\s+weeks?/i);
  if (intervalMatch) {
    visits.push({
      id: slugId('visit', `Week ${intervalMatch[1]}`),
      name: `Week ${intervalMatch[1]}`,
      visitClass: 'scheduled',
      nominalWeek: Number.parseInt(intervalMatch[1], 10),
      windowBefore: 3,
      windowAfter: 3,
      windowUnit: 'days',
      provenance: provenance(sectionId),
    });
  }
  return visits;
}

function extractActivitiesFromText(text: string, sectionId: string): StudyDesignActivity[] {
  const pattern =
    /\b(vital signs|physical exam|laboratory|ecg|imaging|adverse events|concomitant medications|pharmacokinetic|efficacy assessment)\b/gi;
  const activities: StudyDesignActivity[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const name = match[0].replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    activities.push({
      id: slugId('activity', name),
      name: name.replace(/\b\w/g, (char) => char.toUpperCase()),
      activityType: 'assessment',
      provenance: provenance(sectionId),
    });
  }
  return activities;
}

function extractEpochsFromText(text: string, sectionId: string): StudyDesignEpoch[] {
  const pattern = /\b(screening|treatment|follow[- ]?up|run[- ]?in)\b/gi;
  const epochs: StudyDesignEpoch[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const name = match[0].replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    epochs.push({
      id: slugId('epoch', name),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      provenance: provenance(sectionId),
    });
  }
  return epochs;
}

function extractMilestonesFromText(text: string, sectionId: string): StudyDesignMilestone[] {
  const milestones: StudyDesignMilestone[] = [];
  const rules: Array<{ pattern: RegExp; type: StudyDesignMilestone['milestoneType']; label: string }> = [
    { pattern: /\brandomization occurs\b|\brandomized after screening\b/i, type: 'randomization', label: 'Randomization' },
    { pattern: /\bfirst dose\b/i, type: 'firstDose', label: 'First Dose' },
    { pattern: /\blast dose\b/i, type: 'lastDose', label: 'Last Dose' },
    { pattern: /\btreatment completion\b/i, type: 'treatmentCompletion', label: 'Treatment Completion' },
    { pattern: /\bend of treatment\b|\beot\b/i, type: 'endOfTreatment', label: 'End of Treatment' },
    { pattern: /\bend of study\b|\beos\b/i, type: 'endOfStudy', label: 'End of Study' },
    { pattern: /\bsafety follow[- ]?up\b/i, type: 'safetyFollowUp', label: 'Safety Follow-up' },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      milestones.push({
        id: slugId('milestone', rule.label),
        name: rule.label,
        milestoneType: rule.type,
        provenance: provenance(sectionId),
      });
    }
  }
  return milestones;
}

function extractAnchorsFromText(text: string, sectionId: string): StudyDesignScheduleAnchor[] {
  const anchors: StudyDesignScheduleAnchor[] = [];
  const rules: Array<{ pattern: RegExp; type: StudyDesignScheduleAnchor['anchorType']; label: string }> = [
    { pattern: /\brandomization\b/i, type: 'randomization', label: 'Randomization' },
    { pattern: /\bfirst dose\b/i, type: 'firstDose', label: 'First Dose' },
    { pattern: /\blast dose\b/i, type: 'lastDose', label: 'Last Dose' },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      anchors.push({
        id: slugId('anchor', rule.label),
        name: rule.label,
        anchorType: rule.type,
        provenance: provenance(sectionId),
      });
    }
  }
  return anchors;
}

function mergeByName<T extends { id: string; name: string }>(existing: T[], incoming: T[]): {
  added: T[];
  modified: T[];
} {
  const added: T[] = [];
  const modified: T[] = [];
  const byName = new Map(existing.map((item) => [item.name.toLowerCase(), item]));
  for (const item of incoming) {
    const match = byName.get(item.name.toLowerCase());
    if (!match) {
      added.push(item);
    } else if (match.id !== item.id) {
      modified.push({ ...item, id: match.id });
    }
  }
  return { added, modified };
}

function findRemoved<T extends { name: string }>(
  existing: T[],
  incoming: T[],
  sectionTexts: string[],
): T[] {
  const incomingNames = new Set(incoming.map((item) => item.name.toLowerCase()));
  const haystack = sectionTexts.join(' ').toLowerCase();
  return existing.filter((item) => {
    if (incomingNames.has(item.name.toLowerCase())) return false;
    return !haystack.includes(item.name.toLowerCase());
  });
}

/**
 * Detect narrative changes and produce a StudyDesignSyncProposal.
 * Never auto-applies — caller must accept explicitly.
 */
export function detectNarrativeChangesForStudyDesign(
  previousDesign: StudyDesign | null = getStudyDesign(),
): StudyDesignSyncProposal | null {
  const sectionsWithContent = STUDY_DESIGN_NARRATIVE_SECTION_IDS.filter((sectionId) =>
    hasSubstantiveEditorContent(collectNarrativeSectionText(sectionId)),
  );

  if (sectionsWithContent.length === 0) {
    return null;
  }

  const base = previousDesign ?? createEmptyStudyDesign();
  const proposed: StudyDesign = {
    ...base,
    arms: [...base.arms],
    epochs: [...base.epochs],
    anchors: [...(base.anchors ?? [])],
    visits: [...base.visits],
    activities: [...base.activities],
    milestones: [...base.milestones],
    scheduleRules: [...base.scheduleRules],
    detectionSources: [...new Set([...base.detectionSources, 'protocolNarrative' as const])],
  };

  const addedItems: StudyDesignSyncItem[] = [];
  const modifiedItems: StudyDesignSyncItem[] = [];
  const removedItems: StudyDesignSyncItem[] = [];

  const sectionTexts = sectionsWithContent.map((id) => collectNarrativeSectionText(id));

  for (const sectionId of sectionsWithContent) {
    const text = collectNarrativeSectionText(sectionId);

    for (const visit of extractVisitsFromText(text, sectionId)) {
      const { added, modified } = mergeByName(proposed.visits, [visit]);
      for (const item of added) {
        proposed.visits.push(item);
        addedItems.push(
          syncItem('visit', item.id, item.name, sectionId, `Detected visit timing in Section ${sectionId}.`),
        );
      }
      for (const item of modified) {
        modifiedItems.push(
          syncItem('visit', item.id, item.name, sectionId, `Updated visit from Section ${sectionId}.`),
        );
      }
    }

    for (const activity of extractActivitiesFromText(text, sectionId)) {
      const { added } = mergeByName(proposed.activities, [activity]);
      for (const item of added) {
        proposed.activities.push(item);
        addedItems.push(
          syncItem('activity', item.id, item.name, sectionId, `Detected activity in Section ${sectionId}.`),
        );
      }
    }

    for (const epoch of extractEpochsFromText(text, sectionId)) {
      const { added } = mergeByName(proposed.epochs, [epoch]);
      for (const item of added) {
        proposed.epochs.push(item);
        addedItems.push(
          syncItem('epoch', item.id, item.name, sectionId, `Detected epoch in Section ${sectionId}.`),
        );
      }
    }

    for (const milestone of extractMilestonesFromText(text, sectionId)) {
      const { added } = mergeByName(proposed.milestones, [milestone]);
      for (const item of added) {
        proposed.milestones.push(item);
        addedItems.push(
          syncItem('milestone', item.id, item.name, sectionId, `Detected milestone in Section ${sectionId}.`),
        );
      }
    }

    for (const anchor of extractAnchorsFromText(text, sectionId)) {
      const { added } = mergeByName(proposed.anchors ?? [], [anchor]);
      for (const item of added) {
        proposed.anchors = [...(proposed.anchors ?? []), item];
        addedItems.push(
          syncItem('anchor', item.id, item.name, sectionId, `Detected schedule anchor in Section ${sectionId}.`),
        );
      }
    }
  }

  for (const removed of findRemoved(base.visits, proposed.visits, sectionTexts)) {
    removedItems.push(
      syncItem('visit', removed.id, removed.name, sectionsWithContent[0], 'Visit no longer referenced in narrative.'),
    );
  }

  if (addedItems.length === 0 && modifiedItems.length === 0 && removedItems.length === 0) {
    return null;
  }

  return {
    id: `study-design-narrative-sync-${Date.now()}`,
    createdAt: now(),
    status: 'proposed',
    source: 'narrativeChange',
    detectionSources: ['protocolNarrative'],
    addedItems,
    modifiedItems,
    removedItems,
    updatedItems: modifiedItems,
    conflicts: [],
    proposedDesign: proposed,
    reason: 'Protocol narrative changes may require Study Design updates.',
  };
}

export function narrativeSectionHasScheduleSignals(sectionId: StudyDesignNarrativeSectionId): boolean {
  return hasSubstantiveEditorContent(collectNarrativeSectionText(sectionId));
}
