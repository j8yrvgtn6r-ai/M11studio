import { getKnowledgeGraph } from '../knowledge-graph/knowledgeGraphStore';
import { getProtocolDocument } from '../protocol/store/protocolStore';
import { getProtocolImportState } from '../protocol/import/protocolImportStore';
import { hasSubstantiveEditorContent } from '../protocol/authoring/richTextContent';
import { getStudyModel } from '../study-model/studyModelStore';
import { getSoAKnowledge } from '../soa-knowledge/soaKnowledgeStore';
import { applySoAKnowledgePatch, createEmptySoAKnowledgeModel, normalizeSoAName } from '../soa-knowledge/soaKnowledgePatch';
import type { SoAKnowledgeModel, SoAProtocolSectionInput } from '../soa-knowledge/soaKnowledgeTypes';
import {
  createEmptyStudyDesign,
  getStudyDesign,
  replaceStudyDesignFromSync,
} from './StudyDesignStore';
import type {
  StudyDesign,
  StudyDesignActivity,
  StudyDesignArm,
  StudyDesignDetectionSource,
  StudyDesignEpoch,
  StudyDesignMilestone,
  StudyDesignProvenance,
  StudyDesignScheduleRule,
  StudyDesignSoAExportHints,
  StudyDesignSyncConflict,
  StudyDesignSyncItem,
  StudyDesignSyncProposal,
  StudyDesignVisit,
} from './StudyDesignTypes';

const RELEVANT_SECTION_IDS = ['1.3', '4', '6', '8', '9', '10'];

function slugId(prefix: string, name: string): string {
  const slug = normalizeSoAName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  return `sync-${prefix}-${slug}`;
}

function provenance(source: StudyDesignProvenance['source']): StudyDesignProvenance {
  const now = new Date().toISOString();
  return { source, createdAt: now, updatedAt: now };
}

function syncItem(
  kind: StudyDesignSyncItem['kind'],
  id: string,
  name: string,
  source: StudyDesignProvenance['source'],
): StudyDesignSyncItem {
  return { kind, id, name, source };
}

function mapArmType(raw?: string): string {
  const normalized = (raw ?? '').toLowerCase();
  if (/placebo/.test(normalized)) return 'placebo';
  if (/observation|control/.test(normalized)) return 'observation';
  if (/treatment|experimental|active/.test(normalized)) return 'treatment';
  return raw?.trim() || 'treatment';
}

function mapActivityType(raw?: string): StudyDesignActivity['activityType'] {
  const normalized = (raw ?? '').toLowerCase();
  if (/procedure/.test(normalized)) return 'procedure';
  if (/endpoint/.test(normalized)) return 'endpoint';
  if (/admin/.test(normalized)) return 'administrative';
  return 'assessment';
}

function mapVisitClass(raw?: string): StudyDesignVisit['visitClass'] {
  const normalized = (raw ?? '').toLowerCase();
  if (/unscheduled/.test(normalized)) return 'unscheduled';
  if (/special/.test(normalized)) return 'special';
  if (/non[- ]?visit/.test(normalized)) return 'nonVisit';
  if (/manual/.test(normalized)) return 'manual';
  return 'scheduled';
}

function mapMilestoneType(name: string): string {
  const normalized = name.toLowerCase();
  if (/random/.test(normalized)) return 'randomization';
  if (/first dose/.test(normalized)) return 'firstDose';
  if (/last dose/.test(normalized)) return 'lastDose';
  if (/treatment completion/.test(normalized)) return 'treatmentCompletion';
  if (/safety follow/.test(normalized)) return 'safetyFollowUp';
  if (/end of study|eos/.test(normalized)) return 'endOfStudy';
  if (/screen/.test(normalized)) return 'screening';
  return 'other';
}

function collectNarrativeSections(): SoAProtocolSectionInput[] {
  const document = getProtocolDocument();
  const drafts = getProtocolImportState().sectionDrafts;
  return RELEVANT_SECTION_IDS.map((sectionId) => {
    const draft = drafts[sectionId];
    const draftText =
      draft?.validatedTargetText?.trim() ||
      draft?.generatedText?.trim() ||
      draft?.sourceText?.trim() ||
      '';
    const manualText = (document.elements ?? [])
      .filter((element) => element.sectionId === sectionId)
      .map((element) => String(element.value ?? ''))
      .join('\n');
    const text = draftText || manualText;
    return { sectionId, title: sectionId, text };
  }).filter((section) => hasSubstantiveEditorContent(section.text));
}

function extractEpochsFromNarrative(sections: SoAProtocolSectionInput[]): StudyDesignEpoch[] {
  const pattern = /\b(screening|treatment|follow[- ]?up|run[- ]?in|washout)\b/gi;
  const epochs: StudyDesignEpoch[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    for (const match of section.text.matchAll(pattern)) {
      const name = match[0].replace(/\s+/g, ' ').trim();
      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      epochs.push({
        id: slugId('epoch', name),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        provenance: provenance('protocolNarrative'),
      });
    }
  }
  return epochs;
}

function extractVisitsFromNarrative(sections: SoAProtocolSectionInput[], epochs: StudyDesignEpoch[]): StudyDesignVisit[] {
  const pattern = /\b(cycle\s*\d+\s*day\s*\d+|day\s*\d+|week\s*\d+|visit\s*\d+[a-z]?|screening|baseline|randomization|follow[- ]?up)\b/gi;
  const visits: StudyDesignVisit[] = [];
  const seen = new Set<string>();
  const defaultEpochId = epochs[0]?.id;
  for (const section of sections) {
    for (const match of section.text.matchAll(pattern)) {
      const name = match[0].replace(/\s+/g, ' ').trim();
      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      visits.push({
        id: slugId('visit', name),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        visitClass: /unscheduled/i.test(name) ? 'unscheduled' : 'scheduled',
        epochId: defaultEpochId,
        provenance: provenance('protocolNarrative'),
      });
    }
  }
  return visits;
}

function extractActivitiesFromNarrative(sections: SoAProtocolSectionInput[]): StudyDesignActivity[] {
  const pattern =
    /\b(vital signs|physical exam|laboratory|ecg|imaging|adverse events|concomitant medications|pharmacokinetic|efficacy assessment)\b/gi;
  const activities: StudyDesignActivity[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    for (const match of section.text.matchAll(pattern)) {
      const name = match[0].replace(/\s+/g, ' ').trim();
      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      activities.push({
        id: slugId('activity', name),
        name: name.replace(/\b\w/g, (char) => char.toUpperCase()),
        activityType: mapActivityType(name),
        provenance: provenance('protocolNarrative'),
      });
    }
  }
  return activities;
}

export function buildStudyDesignFromKnowledgeGraph(protocolId?: string): StudyDesignSyncProposal {
  const base = getStudyDesign() ?? createEmptyStudyDesign(protocolId);
  const graph = getKnowledgeGraph();
  const studyModel = getStudyModel();
  const soaKnowledge = getSoAKnowledge();
  const narrativeSections = collectNarrativeSections();

  const addedItems: StudyDesignSyncItem[] = [];
  const updatedItems: StudyDesignSyncItem[] = [];
  const conflicts: StudyDesignSyncConflict[] = [];
  const detectionSources = new Set<StudyDesignDetectionSource>(base.detectionSources);

  const next: StudyDesign = {
    ...base,
    arms: [...base.arms],
    cohorts: [...base.cohorts],
    epochs: [...base.epochs],
    elements: [...base.elements],
    anchors: [...(base.anchors ?? [])],
    visits: [...base.visits],
    activities: [...base.activities],
    milestones: [...base.milestones],
    scheduleRules: [...base.scheduleRules],
  };

  function upsertArm(arm: StudyDesignArm) {
    const existing = next.arms.find((item) => item.id === arm.id || item.name.toLowerCase() === arm.name.toLowerCase());
    if (existing && existing.id !== arm.id) {
      conflicts.push({
        kind: 'arm',
        id: arm.id,
        message: `Arm "${arm.name}" conflicts with existing "${existing.name}".`,
        existingName: existing.name,
        proposedName: arm.name,
      });
      return;
    }
    if (existing) {
      updatedItems.push(syncItem('arm', arm.id, arm.name, arm.provenance.source));
      Object.assign(existing, arm);
    } else {
      addedItems.push(syncItem('arm', arm.id, arm.name, arm.provenance.source));
      next.arms.push(arm);
    }
  }

  function upsertEpoch(epoch: StudyDesignEpoch) {
    const existing = next.epochs.find((item) => item.name.toLowerCase() === epoch.name.toLowerCase());
    if (existing) {
      updatedItems.push(syncItem('epoch', existing.id, existing.name, epoch.provenance.source));
      return;
    }
    addedItems.push(syncItem('epoch', epoch.id, epoch.name, epoch.provenance.source));
    next.epochs.push(epoch);
  }

  function upsertVisit(visit: StudyDesignVisit) {
    const existing = next.visits.find((item) => item.name.toLowerCase() === visit.name.toLowerCase());
    if (existing) {
      updatedItems.push(syncItem('visit', existing.id, existing.name, visit.provenance.source));
      if (!existing.epochId && visit.epochId) {
        existing.epochId = visit.epochId;
      }
      return;
    }
    addedItems.push(syncItem('visit', visit.id, visit.name, visit.provenance.source));
    next.visits.push(visit);
  }

  function upsertActivity(activity: StudyDesignActivity) {
    const existing = next.activities.find((item) => item.name.toLowerCase() === activity.name.toLowerCase());
    if (existing) {
      updatedItems.push(syncItem('activity', existing.id, existing.name, activity.provenance.source));
      return;
    }
    addedItems.push(syncItem('activity', activity.id, activity.name, activity.provenance.source));
    next.activities.push(activity);
  }

  function upsertMilestone(milestone: StudyDesignMilestone) {
    const existing = next.milestones.find((item) => item.name.toLowerCase() === milestone.name.toLowerCase());
    if (existing) {
      updatedItems.push(syncItem('milestone', existing.id, existing.name, milestone.provenance.source));
      return;
    }
    addedItems.push(syncItem('milestone', milestone.id, milestone.name, milestone.provenance.source));
    next.milestones.push(milestone);
  }

  if (graph?.entities?.length) {
    detectionSources.add('knowledgeGraph');
    for (const entity of graph.entities) {
      if (entity.entityType === 'arm') {
        upsertArm({
          id: slugId('arm', entity.name),
          name: entity.name,
          type: mapArmType(entity.metadata?.armType as string),
          provenance: provenance('knowledgeGraph'),
        });
      }
      if (entity.entityType === 'visit') {
        upsertVisit({
          id: slugId('visit', entity.name),
          name: entity.name,
          visitClass: mapVisitClass(entity.metadata?.visitType as string),
          epochId: next.epochs[0]?.id,
          provenance: provenance('knowledgeGraph'),
        });
      }
      if (entity.entityType === 'activity' || entity.entityType === 'assessment' || entity.entityType === 'procedure') {
        upsertActivity({
          id: slugId('activity', entity.name),
          name: entity.name,
          activityType: mapActivityType(entity.entityType === 'procedure' ? 'procedure' : 'assessment'),
          description: entity.description,
          provenance: provenance('knowledgeGraph'),
        });
      }
    }
  }

  if (studyModel) {
    detectionSources.add('knowledgeGraph');
    for (const item of studyModel.arms) {
      upsertArm({
        id: slugId('arm', item.name),
        name: item.name,
        type: 'treatment',
        provenance: provenance('studyModel'),
      });
    }
    for (const item of studyModel.epochs) {
      upsertEpoch({
        id: slugId('epoch', item.name),
        name: item.name,
        provenance: provenance('studyModel'),
      });
    }
    for (const item of studyModel.visits) {
      upsertVisit({
        id: slugId('visit', item.name),
        name: item.name,
        visitClass: 'scheduled',
        epochId: next.epochs[0]?.id,
        provenance: provenance('studyModel'),
      });
    }
    for (const item of studyModel.activities) {
      upsertActivity({
        id: slugId('activity', item.name),
        name: item.name,
        activityType: 'assessment',
        provenance: provenance('studyModel'),
      });
    }
  }

  if (soaKnowledge) {
    detectionSources.add('knowledgeGraph');
    for (const arm of soaKnowledge.arms) {
      upsertArm({
        id: slugId('arm', arm.name),
        name: arm.name,
        type: mapArmType(arm.armType),
        provenance: provenance('soaKnowledge'),
      });
    }
    for (const epoch of soaKnowledge.epochs) {
      upsertEpoch({
        id: slugId('epoch', epoch.name),
        name: epoch.name,
        provenance: provenance('soaKnowledge'),
      });
    }
    for (const visit of soaKnowledge.visits) {
      upsertVisit({
        id: slugId('visit', visit.name),
        name: visit.name,
        visitClass: mapVisitClass(visit.visitType),
        epochId: visit.epochId ?? next.epochs[0]?.id,
        provenance: provenance('soaKnowledge'),
      });
    }
    for (const activity of soaKnowledge.activities) {
      upsertActivity({
        id: slugId('activity', activity.name),
        name: activity.name,
        activityType: mapActivityType(activity.activityType),
        provenance: provenance('soaKnowledge'),
      });
    }
    for (const assessment of soaKnowledge.assessments) {
      upsertActivity({
        id: slugId('activity', assessment.name),
        name: assessment.name,
        activityType: 'assessment',
        description: assessment.description,
        provenance: provenance('soaKnowledge'),
      });
    }
    for (const anchor of soaKnowledge.milestones ?? []) {
      upsertMilestone({
        id: slugId('milestone', anchor.name),
        name: anchor.name,
        milestoneType: mapMilestoneType(anchor.name),
        provenance: provenance('soaKnowledge'),
      });
    }
  }

  if (narrativeSections.length > 0) {
    detectionSources.add('protocolNarrative');
    const narrativeEpochs = extractEpochsFromNarrative(narrativeSections);
    for (const epoch of narrativeEpochs) {
      upsertEpoch(epoch);
    }
    for (const visit of extractVisitsFromNarrative(narrativeSections, next.epochs)) {
      upsertVisit(visit);
    }
    for (const activity of extractActivitiesFromNarrative(narrativeSections)) {
      upsertActivity(activity);
    }
  }

  if (next.epochs.length === 0 && next.visits.length > 0) {
    upsertEpoch({
      id: slugId('epoch', 'Treatment'),
      name: 'Treatment',
      provenance: provenance('protocolNarrative'),
    });
    for (const visit of next.visits) {
      if (!visit.epochId) {
        visit.epochId = next.epochs[0]?.id;
      }
    }
  }

  next.detectionSources = [...detectionSources];

  return {
    id: `study-design-sync-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'proposed',
    source: 'knowledgeGraph',
    detectionSources: next.detectionSources,
    addedItems,
    modifiedItems: updatedItems,
    removedItems: [],
    updatedItems,
    conflicts,
    proposedDesign: next,
  };
}

export function acceptStudyDesignSyncProposal(proposal: StudyDesignSyncProposal): StudyDesign {
  const accepted: StudyDesign = {
    ...proposal.proposedDesign,
    detectionSources: proposal.detectionSources,
    updatedAt: new Date().toISOString(),
  };
  return replaceStudyDesignFromSync(accepted);
}

export function buildAndApplyStudyDesignFromSources(protocolId?: string): StudyDesignSyncProposal {
  const proposal = buildStudyDesignFromKnowledgeGraph(protocolId);
  acceptStudyDesignSyncProposal(proposal);
  return { ...proposal, status: 'accepted' };
}

export function buildSoAExportHintsFromStudyDesign(
  studyDesign: StudyDesign | null = getStudyDesign(),
): StudyDesignSoAExportHints {
  if (!studyDesign) {
    return { footnoteSuggestions: [], timingSuggestions: [], milestoneRowSuggestions: [] };
  }

  const footnoteSuggestions: string[] = [];
  const timingSuggestions: string[] = [];
  const milestoneRowSuggestions: string[] = [];

  for (const visit of studyDesign.visits) {
    if (visit.windowBefore != null || visit.windowAfter != null) {
      const unit = visit.windowUnit === 'weeks' ? 'week' : 'day';
      const before = visit.windowBefore ?? 0;
      const after = visit.windowAfter ?? 0;
      timingSuggestions.push(`${visit.name}: ±${Math.max(before, after)} ${unit}${Math.max(before, after) === 1 ? '' : 's'}`);
      footnoteSuggestions.push(`Visit window for ${visit.name}: -${before}/+${after} ${unit}s from nominal.`);
    }
    if (visit.scheduleAnchorId && visit.offsetDays != null) {
      const anchor = (studyDesign.anchors ?? []).find((item) => item.id === visit.scheduleAnchorId);
      timingSuggestions.push(
        `${visit.name}: ${visit.offsetDays >= 0 ? '+' : ''}${visit.offsetDays} days from ${anchor?.name ?? 'anchor'}`,
      );
    }
  }

  for (const milestone of studyDesign.milestones) {
    milestoneRowSuggestions.push(`Include milestone row: ${milestone.name} (${milestone.milestoneType})`);
  }

  for (const rule of studyDesign.scheduleRules) {
    if (rule.footnote) {
      footnoteSuggestions.push(rule.footnote);
    } else if (rule.conditionalExpression) {
      footnoteSuggestions.push(`Condition: ${rule.conditionalExpression}`);
    }
  }

  return { footnoteSuggestions, timingSuggestions, milestoneRowSuggestions };
}

export function buildSoAKnowledgeFromStudyDesign(
  studyDesign: StudyDesign | null = getStudyDesign(),
  protocolId?: string,
): SoAKnowledgeModel {
  const resolvedProtocolId = protocolId ?? studyDesign?.protocolId ?? getProtocolDocument().id ?? 'protocol-draft';
  const base = createEmptySoAKnowledgeModel(resolvedProtocolId);
  if (!studyDesign) {
    return base;
  }

  const hints = buildSoAExportHintsFromStudyDesign(studyDesign);

  return applySoAKnowledgePatch(base, {
    arms: studyDesign.arms.map((arm) => ({
      id: arm.id,
      name: arm.name,
      armType: String(arm.type),
      sourceSectionIds: ['4'],
      inferenceSource: 'deterministic',
    })),
    epochs: studyDesign.epochs.map((epoch) => ({
      id: epoch.id,
      name: epoch.name,
      sourceSectionIds: ['4'],
      inferenceSource: 'deterministic',
    })),
    visits: studyDesign.visits.map((visit) => {
      const anchor = (studyDesign.anchors ?? []).find((item) => item.id === visit.scheduleAnchorId);
      const windowLabel =
        visit.windowBefore != null || visit.windowAfter != null
          ? `±${visit.windowBefore ?? visit.windowAfter ?? 0} ${visit.windowUnit ?? 'days'}`
          : undefined;
      return {
        id: visit.id,
        name: visit.name,
        visitType: visit.visitClass,
        epochId: visit.epochId,
        anchorId: visit.scheduleAnchorId ?? visit.anchorVisit,
        nominalDay: visit.nominalDay,
        nominalWeek: visit.nominalWeek,
        window: windowLabel,
        required: true,
        sourceSectionIds: ['1.3', '4', '5'],
        inferenceSource: 'deterministic',
        rationale: anchor && visit.offsetDays != null
          ? `${visit.offsetDays} days from ${anchor.name}`
          : visit.nominalDay != null
            ? `Nominal day ${visit.nominalDay}`
            : undefined,
      };
    }),
    activities: studyDesign.activities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      activityType: activity.activityType as never,
      sourceSectionIds: ['8'],
      inferenceSource: 'deterministic',
    })),
    assessments: studyDesign.activities
      .filter((activity) => activity.activityType === 'assessment')
      .map((activity) => ({
        id: activity.id,
        name: activity.name,
        category: 'other' as const,
        description: activity.description,
        sourceSectionIds: ['8'],
        inferenceSource: 'deterministic' as const,
      })),
    scheduleRules: studyDesign.scheduleRules.map((rule) => ({
      id: rule.id,
      visitId: rule.visitId,
      assessmentId: rule.activityId,
      required: rule.required,
      notes: rule.footnote ?? rule.conditionalExpression,
      sourceSectionIds: ['1.3', '8'],
      inferenceSource: 'deterministic' as const,
    })),
    milestones: studyDesign.milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      milestoneType: String(milestone.milestoneType),
      anchorDateOrEvent: milestone.anchorVisitId,
      description: milestone.description,
      sourceSectionIds: ['1.3', '4', '5'],
      inferenceSource: 'deterministic',
    })),
    footnotes: hints.footnoteSuggestions.map((text, index) => ({
      id: `study-design-footnote-${index}`,
      label: `Footnote ${index + 1}`,
      text,
      appliesToIds: [],
      sourceSectionIds: ['1.3'],
      inferenceSource: 'deterministic' as const,
    })),
    timingWindows: hints.timingSuggestions.map((text, index) => ({
      id: `study-design-timing-${index}`,
      label: text,
      sourceSectionIds: ['1.3', '4'],
      inferenceSource: 'deterministic' as const,
    })),
    extractionNotes: [
      'Study Design v2 seeded visits, activities, milestones, anchors, and schedule rules.',
      ...hints.milestoneRowSuggestions,
    ],
  });
}
