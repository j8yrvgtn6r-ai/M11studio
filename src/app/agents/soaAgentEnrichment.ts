import type { KnowledgeGraph } from '../domain/knowledge-graph/knowledgeGraphTypes';
import type { ProtocolDocument } from '../domain/protocol/types';
import { resolveLlmProviderConfig } from '../domain/protocol/import/llm/llmConfig';
import { callOpenAiChat } from '../domain/protocol/import/llm/openAiClient';
import { parseLlmJson } from '../domain/protocol/import/llm/parseLlmJson';
import { evaluateSoAScheduleExtraction } from './soaAgentRules';
import {
  countEnrichmentProposalItems,
  type SoAEnrichedAssessment,
  type SoAEnrichedCondition,
  type SoAEnrichedScheduleRule,
  type SoAEnrichedTimingWindow,
  type SoAEnrichedVisit,
  type SoAEnrichmentProposal,
  type SoAEnrichmentProposalCounts,
  type SoAEnrichmentRationaleEntry,
} from '../domain/soa-knowledge/soaEnrichmentProposal';
import { getSoAKnowledgeSummary } from '../domain/soa-knowledge/soaKnowledgeSelectors';
import type {
  SoAEvidenceReference,
  SoAInferenceSource,
  SoAKnowledgeModel,
  SoAProtocolSectionInput,
} from '../domain/soa-knowledge/soaKnowledgeTypes';
import { normalizeSoAName } from '../domain/soa-knowledge/soaKnowledgePatch';
import { createSoANarrativeImpactRecord, getNarrativeSectionsImpactedBySoAChange } from '../domain/soa-knowledge/soaKnowledgeNarrativeSync';

export const SOA_ENRICHMENT_PROMPT_VERSION = 'soa-enrichment-v1';

export interface SoAEnrichmentInput {
  protocolSections: SoAProtocolSectionInput[];
  deterministicModel: SoAKnowledgeModel;
  knowledgeGraph?: KnowledgeGraph | null;
  existingSoAConfiguration?: ProtocolDocument;
  providerId?: string;
}

export interface SoAEnrichmentLlmEvidenceItem {
  sectionId?: string;
  sourceText?: string;
  reason?: string;
}

export interface SoAEnrichmentLlmNamedItem extends SoAEnrichmentLlmEvidenceItem {
  name?: string;
  label?: string;
  text?: string;
  category?: string;
  inferenceSource?: SoAInferenceSource;
  rationale?: string;
  reconciledWith?: string;
}

export interface SoAEnrichmentLlmScheduleRule extends SoAEnrichmentLlmEvidenceItem {
  assessmentName?: string;
  visitName?: string;
  procedureName?: string;
  required?: boolean;
  notes?: string;
  inferenceSource?: SoAInferenceSource;
  rationale?: string;
}

export interface SoAEnrichmentLlmResponse {
  visits?: SoAEnrichmentLlmNamedItem[];
  assessments?: SoAEnrichmentLlmNamedItem[];
  procedures?: SoAEnrichmentLlmNamedItem[];
  activities?: SoAEnrichmentLlmNamedItem[];
  timingWindows?: SoAEnrichmentLlmNamedItem[];
  conditions?: SoAEnrichmentLlmNamedItem[];
  footnotes?: SoAEnrichmentLlmNamedItem[];
  scheduleRules?: SoAEnrichmentLlmScheduleRule[];
  rationale?: Array<{ itemKind?: string; itemName?: string; rationale?: string; inferenceSource?: SoAInferenceSource }>;
  warnings?: string[];
}

export interface SoAEnrichmentBuildResult {
  proposal: SoAEnrichmentProposal;
  discardedCount: number;
}

function slugId(prefix: string, value: string): string {
  const slug = normalizeSoAName(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${prefix}-${slug || 'item'}`;
}

function truncate(text: string, max = 4000): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n\n[truncated]`;
}

function relevantSections(sections: SoAProtocolSectionInput[]): SoAProtocolSectionInput[] {
  const preferred = ['1.3', '4', '6', '8', '9', '10'];
  const picked = sections.filter((section) => preferred.some((id) => section.sectionId === id || section.sectionId.startsWith(`${id}.`)));
  return (picked.length > 0 ? picked : sections).slice(0, 12);
}

function summarizeKnowledgeGraph(graph?: KnowledgeGraph | null): string {
  if (!graph?.entities?.length) {
    return 'No Knowledge Graph entities available.';
  }
  const visits = graph.entities.filter((entity) => entity.entityType === 'visit').slice(0, 8);
  const assessments = graph.entities.filter((entity) => entity.entityType === 'assessment').slice(0, 8);
  return [
    `Entities: ${graph.entities.length}, Relationships: ${graph.relationships?.length ?? 0}`,
    visits.length ? `Visits: ${visits.map((entity) => entity.name).join(', ')}` : '',
    assessments.length ? `Assessments: ${assessments.map((entity) => entity.name).join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

export function buildSoAEnrichmentPrompt(input: SoAEnrichmentInput): { system: string; user: string } {
  const summary = getSoAKnowledgeSummary(input.deterministicModel);
  const sections = relevantSections(input.protocolSections);
  const deterministicSnapshot = {
    visits: input.deterministicModel.visits.map((visit) => visit.name),
    assessments: input.deterministicModel.assessments.map((assessment) => assessment.name),
    procedures: input.deterministicModel.procedures.map((procedure) => procedure.name),
    conditions: input.deterministicModel.conditions.map((condition) => condition.label),
    timingWindows: input.deterministicModel.timingWindows.map((window) => window.label),
    scheduleRules: input.deterministicModel.scheduleRules.length,
  };

  const system = [
    'You enrich an existing deterministic Schedule of Activities extraction for a clinical protocol.',
    'Return JSON only. Do not mutate configuration or invent unsupported schedule facts.',
    'Every suggested item MUST include sectionId, sourceText, and reason citing explicit protocol language.',
    'Do not propose visits, assessments, procedures, activities, timing windows, conditions, footnotes, or schedule rules without direct evidence.',
    'Prefer reconciling duplicate concepts (e.g. Tumor Imaging vs Radiographic Assessment) using inferenceSource "llm-reconciled".',
    'Use inferenceSource values: llm-inferred, llm-reconciled.',
    `Prompt version: ${SOA_ENRICHMENT_PROMPT_VERSION}`,
  ].join('\n');

  const user = JSON.stringify({
    task: 'Identify missed schedule entities, timing windows, conditions, footnotes, and explicit schedule rules supported by protocol text.',
    deterministicSummary: summary,
    deterministicSnapshot,
    knowledgeGraphSummary: summarizeKnowledgeGraph(input.knowledgeGraph),
    protocolSections: sections.map((section) => ({
      sectionId: section.sectionId,
      title: section.title,
      text: truncate(section.text),
    })),
    responseSchema: {
      visits: [],
      assessments: [],
      procedures: [],
      activities: [],
      timingWindows: [],
      conditions: [],
      footnotes: [],
      scheduleRules: [],
      rationale: [],
      warnings: [],
    },
  });

  return { system, user };
}

function toEvidence(item: SoAEnrichmentLlmEvidenceItem): SoAEvidenceReference | null {
  const sectionId = item.sectionId?.trim();
  const sourceText = item.sourceText?.trim();
  const reason = item.reason?.trim();
  if (!sectionId || !sourceText || !reason) {
    return null;
  }
  return { sectionId, sourceText, reason };
}

function evidenceMatchesSectionText(evidence: SoAEvidenceReference, sections: SoAProtocolSectionInput[]): boolean {
  const section = sections.find((entry) => entry.sectionId === evidence.sectionId);
  if (!section) {
    return false;
  }
  const normalizedExcerpt = normalizeSoAName(evidence.sourceText);
  if (normalizedExcerpt.length < 8) {
    return normalizeSoAName(section.text).includes(normalizedExcerpt);
  }
  return normalizeSoAName(section.text).includes(normalizedExcerpt.slice(0, Math.min(normalizedExcerpt.length, 80)));
}

function isDuplicateName(name: string, existingNames: Set<string>): boolean {
  return existingNames.has(normalizeSoAName(name));
}

function resolveInferenceSource(value?: SoAInferenceSource, reconciledWith?: string): SoAInferenceSource {
  if (reconciledWith) {
    return 'llm-reconciled';
  }
  if (value === 'llm-reconciled' || value === 'llm-inferred') {
    return value;
  }
  return 'llm-inferred';
}

function buildDeterministicCounts(model: SoAKnowledgeModel): SoAEnrichmentProposalCounts {
  return {
    visits: model.visits.length,
    assessments: model.assessments.length,
    procedures: model.procedures.length,
    activities: model.activities.length,
    conditions: model.conditions.length,
    timingWindows: model.timingWindows.length,
    scheduleRules: model.scheduleRules.length,
    footnotes: model.footnotes.length,
  };
}

function buildImpactedNarrativeSections(proposal: Pick<
  SoAEnrichmentProposal,
  'proposedVisits' | 'proposedAssessments' | 'proposedScheduleRules' | 'proposedActivities' | 'proposedTimingWindows' | 'proposedConditions'
>): Array<{ sectionId: string; reason: string }> {
  const sections = new Map<string, string>();
  if (proposal.proposedScheduleRules.length > 0 || proposal.proposedAssessments.length > 0) {
    for (const sectionId of getNarrativeSectionsImpactedBySoAChange({ kind: 'assessmentSchedule' })) {
      sections.set(sectionId, createSoANarrativeImpactRecord({ kind: 'assessmentSchedule' }).reasons[sectionId] ?? 'Assessment schedule may require narrative review.');
    }
  }
  if (proposal.proposedVisits.length > 0) {
    for (const sectionId of getNarrativeSectionsImpactedBySoAChange({ kind: 'visitAdded' })) {
      sections.set(sectionId, createSoANarrativeImpactRecord({ kind: 'visitAdded' }).reasons[sectionId] ?? 'Visit timing may require narrative review.');
    }
  }
  if (proposal.proposedActivities.length > 0) {
    for (const sectionId of getNarrativeSectionsImpactedBySoAChange({ kind: 'interventionActivity' })) {
      sections.set(sectionId, createSoANarrativeImpactRecord({ kind: 'interventionActivity' }).reasons[sectionId] ?? 'Intervention activity may require narrative review.');
    }
  }
  if (proposal.proposedTimingWindows.length > 0 || proposal.proposedConditions.length > 0) {
    for (const sectionId of getNarrativeSectionsImpactedBySoAChange({ kind: 'assessmentSchedule' })) {
      sections.set(sectionId, createSoANarrativeImpactRecord({ kind: 'assessmentSchedule' }).reasons[sectionId] ?? 'Schedule timing or conditions may require narrative review.');
    }
  }
  return [...sections.entries()].map(([sectionId, reason]) => ({ sectionId, reason }));
}

export function parseSoAEnrichmentLlmResponse(content: string): SoAEnrichmentLlmResponse | null {
  try {
    const parsed = parseLlmJson<SoAEnrichmentLlmResponse>(content);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildDeterministicBaselineModel(
  sections: SoAProtocolSectionInput[],
  protocolId?: string,
  existingModel?: SoAKnowledgeModel | null,
): SoAKnowledgeModel {
  const output = evaluateSoAScheduleExtraction({
    protocolSections: sections.map((section) => ({
      sectionId: section.sectionId,
      title: section.title,
      text: section.text,
    })),
    trigger: 'manual',
    soaKnowledgeModel: existingModel ?? undefined,
    existingSoAConfiguration: undefined,
  });

  const patch = output.soaKnowledgePatch;
  const base = existingModel ?? {
    id: `soa-knowledge-${protocolId ?? 'local'}`,
    protocolId,
    arms: [],
    epochs: [],
    elements: [],
    visits: [],
    activities: [],
    assessments: [],
    procedures: [],
    timingWindows: [],
    scheduleRules: [],
    conditions: [],
    footnotes: [],
    sourceSectionIds: [],
    extractionNotes: [],
    unmappedTimingReferences: [],
    ambiguousScheduleStatements: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  return {
    ...base,
    visits: (patch.visits ?? []).map((visit) => ({ ...visit, inferenceSource: 'deterministic' as const })),
    assessments: (patch.assessments ?? []).map((assessment) => ({ ...assessment, inferenceSource: 'deterministic' as const })),
    procedures: (patch.procedures ?? []).map((procedure) => ({ ...procedure, inferenceSource: 'deterministic' as const })),
    activities: (patch.activities ?? []).map((activity) => ({ ...activity, inferenceSource: 'deterministic' as const })),
    conditions: (patch.conditions ?? []).map((condition) => ({ ...condition, inferenceSource: 'deterministic' as const })),
    timingWindows: (patch.timingWindows ?? []).map((window) => ({ ...window, inferenceSource: 'deterministic' as const })),
    scheduleRules: (patch.scheduleRules ?? []).map((rule) => ({ ...rule, inferenceSource: 'deterministic' as const })),
    footnotes: (patch.footnotes ?? []).map((footnote) => ({ ...footnote, inferenceSource: 'deterministic' as const })),
    sourceSectionIds: patch.sourceSectionIds ?? base.sourceSectionIds,
    extractionNotes: patch.extractionNotes ?? base.extractionNotes,
    unmappedTimingReferences: patch.unmappedTimingReferences ?? base.unmappedTimingReferences,
    ambiguousScheduleStatements: patch.ambiguousScheduleStatements ?? base.ambiguousScheduleStatements,
    updatedAt: new Date().toISOString(),
  };
}

export function buildFixtureSoAEnrichmentResponse(
  sections: SoAProtocolSectionInput[],
  deterministicModel: SoAKnowledgeModel,
): SoAEnrichmentLlmResponse {
  const corpus = sections.map((section) => section.text).join('\n');
  const response: SoAEnrichmentLlmResponse = { warnings: [], rationale: [] };

  const every8Weeks = /every\s+8\s+weeks/i.exec(corpus);
  if (every8Weeks) {
    const section = sections.find((entry) => entry.text.includes(every8Weeks[0])) ?? sections[0];
    response.timingWindows = [{
      label: 'Every 8 weeks',
      sectionId: section?.sectionId,
      sourceText: every8Weeks[0],
      reason: 'Protocol specifies an every-8-weeks interval.',
      inferenceSource: 'llm-inferred',
      rationale: 'Interval timing not captured by deterministic regex alone.',
    }];
  }

  const clinicallyIndicated = /if clinically indicated/i.exec(corpus);
  if (clinicallyIndicated) {
    const section = sections.find((entry) => entry.text.includes(clinicallyIndicated[0])) ?? sections[0];
    response.conditions = [{
      label: 'If clinically indicated',
      sectionId: section?.sectionId,
      sourceText: clinicallyIndicated[0],
      reason: 'Conditional schedule language appears in protocol text.',
      inferenceSource: 'llm-inferred',
    }];
  }

  const investigatorDiscretion = /at investigator discretion/i.exec(corpus);
  if (investigatorDiscretion) {
    const section = sections.find((entry) => entry.text.includes(investigatorDiscretion[0])) ?? sections[0];
    response.conditions = [
      ...(response.conditions ?? []),
      {
        label: 'At investigator discretion',
        sectionId: section?.sectionId,
        sourceText: investigatorDiscretion[0],
        reason: 'Conditional schedule language appears in protocol text.',
        inferenceSource: 'llm-inferred',
      },
    ];
  }

  const hasTumor = /tumor imaging|radiographic assessment/i.test(corpus);
  const hasRadiographicOnly = deterministicModel.assessments.some((item) => /radiographic assessment/i.test(item.name));
  const hasTumorOnly = deterministicModel.assessments.some((item) => /tumor imaging/i.test(item.name));
  if (hasTumor && hasRadiographicOnly !== hasTumorOnly) {
    const section = sections.find((entry) => /tumor imaging|radiographic assessment/i.test(entry.text)) ?? sections[0];
    const excerpt = section?.text.match(/tumor imaging and radiographic assessment/i)?.[0] ?? 'Tumor imaging and radiographic assessment';
    response.assessments = [{
      name: 'Tumor Imaging',
      category: 'imaging',
      sectionId: section?.sectionId,
      sourceText: excerpt,
      reason: 'Protocol uses alternate imaging labels that likely refer to the same assessment concept.',
      inferenceSource: 'llm-reconciled',
      reconciledWith: 'Radiographic Assessment',
      rationale: 'Reconcile duplicate imaging labels into one assessment concept.',
    }];
    response.rationale = [{
      itemKind: 'assessment',
      itemName: 'Tumor Imaging',
      rationale: 'Reconcile duplicate imaging labels into one assessment concept.',
      inferenceSource: 'llm-reconciled',
    }];
  }

  const missedFollowUp = /follow-up visit/i.exec(corpus);
  if (missedFollowUp && !deterministicModel.visits.some((visit) => /follow-up/i.test(visit.name))) {
    const section = sections.find((entry) => entry.text.includes(missedFollowUp[0])) ?? sections[0];
    response.visits = [{
      name: 'Follow-up Visit',
      sectionId: section?.sectionId,
      sourceText: missedFollowUp[0],
      reason: 'Follow-up visit appears in narrative but was not extracted deterministically.',
      inferenceSource: 'llm-inferred',
    }];
  }

  return response;
}

function mapNamedVisit(
  item: SoAEnrichmentLlmNamedItem,
  sections: SoAProtocolSectionInput[],
  existingNames: Set<string>,
  diagnostics: string[],
): SoAEnrichedVisit | null {
  const name = item.name?.trim();
  if (!name || isDuplicateName(name, existingNames)) {
    return null;
  }
  const evidence = toEvidence(item);
  if (!evidence || !evidenceMatchesSectionText(evidence, sections)) {
    diagnostics.push(`Discarded visit "${name}" — missing or unsupported evidence.`);
    return null;
  }
  return {
    id: slugId('visit', name),
    name,
    order: existingNames.size,
    sourceSectionIds: [evidence.sectionId],
    inferenceSource: resolveInferenceSource(item.inferenceSource, item.reconciledWith),
    evidence: [evidence],
    rationale: item.rationale,
  };
}

function mapNamedAssessment(
  item: SoAEnrichmentLlmNamedItem,
  sections: SoAProtocolSectionInput[],
  existingNames: Set<string>,
  diagnostics: string[],
): SoAEnrichedAssessment | null {
  const name = item.name?.trim();
  if (!name) {
    return null;
  }
  if (item.reconciledWith && isDuplicateName(item.reconciledWith, existingNames)) {
    return null;
  }
  if (!item.reconciledWith && isDuplicateName(name, existingNames)) {
    return null;
  }
  const evidence = toEvidence(item);
  if (!evidence || !evidenceMatchesSectionText(evidence, sections)) {
    diagnostics.push(`Discarded assessment "${name}" — missing or unsupported evidence.`);
    return null;
  }
  return {
    id: slugId('assessment', item.reconciledWith ? item.reconciledWith : name),
    name: item.reconciledWith ?? name,
    category: item.category as SoAEnrichedAssessment['category'],
    sourceSectionIds: [evidence.sectionId],
    inferenceSource: resolveInferenceSource(item.inferenceSource, item.reconciledWith),
    evidence: [evidence],
    rationale: item.rationale ?? (item.reconciledWith ? `Reconciled with ${item.reconciledWith}` : undefined),
  };
}

function mapTimingWindow(
  item: SoAEnrichmentLlmNamedItem,
  sections: SoAProtocolSectionInput[],
  existingLabels: Set<string>,
  diagnostics: string[],
): SoAEnrichedTimingWindow | null {
  const label = item.label?.trim() || item.name?.trim();
  if (!label || isDuplicateName(label, existingLabels)) {
    return null;
  }
  const evidence = toEvidence(item);
  if (!evidence || !evidenceMatchesSectionText(evidence, sections)) {
    diagnostics.push(`Discarded timing window "${label}" — missing or unsupported evidence.`);
    return null;
  }
  const plusMinus = /±\s*(\d+)\s*days?/i.exec(label);
  const withinHours = /within\s+(\d+)\s*hours?/i.exec(label);
  const everyWeeks = /every\s+(\d+)\s*weeks?/i.exec(label);
  return {
    id: slugId('timing', label),
    label,
    windowBefore: plusMinus ? Number(plusMinus[1]) : undefined,
    windowAfter: plusMinus ? Number(plusMinus[1]) : undefined,
    offset: everyWeeks ? Number(everyWeeks[1]) : withinHours ? Number(withinHours[1]) : undefined,
    unit: everyWeeks ? 'weeks' : withinHours ? 'hours' : plusMinus ? 'days' : undefined,
    sourceSectionIds: [evidence.sectionId],
    inferenceSource: resolveInferenceSource(item.inferenceSource),
    evidence: [evidence],
    rationale: item.rationale,
  };
}

function mapCondition(
  item: SoAEnrichmentLlmNamedItem,
  sections: SoAProtocolSectionInput[],
  existingLabels: Set<string>,
  diagnostics: string[],
): SoAEnrichedCondition | null {
  const label = item.label?.trim() || item.name?.trim();
  if (!label || isDuplicateName(label, existingLabels)) {
    return null;
  }
  const evidence = toEvidence(item);
  if (!evidence || !evidenceMatchesSectionText(evidence, sections)) {
    diagnostics.push(`Discarded condition "${label}" — missing or unsupported evidence.`);
    return null;
  }
  return {
    id: slugId('condition', label),
    label,
    expressionText: label,
    sourceSectionIds: [evidence.sectionId],
    inferenceSource: resolveInferenceSource(item.inferenceSource),
    evidence: [evidence],
    rationale: item.rationale,
  };
}

function mapScheduleRule(
  item: SoAEnrichmentLlmScheduleRule,
  sections: SoAProtocolSectionInput[],
  visitNames: Map<string, string>,
  assessmentNames: Map<string, string>,
  diagnostics: string[],
): SoAEnrichedScheduleRule | null {
  const evidence = toEvidence(item);
  const assessmentName = item.assessmentName?.trim();
  const visitName = item.visitName?.trim();
  if (!evidence || !assessmentName || !visitName || !evidenceMatchesSectionText(evidence, sections)) {
    diagnostics.push('Discarded schedule rule — explicit assessment, visit, and evidence required.');
    return null;
  }
  const assessmentId = assessmentNames.get(normalizeSoAName(assessmentName));
  const visitId = visitNames.get(normalizeSoAName(visitName));
  if (!assessmentId || !visitId) {
    diagnostics.push(`Discarded schedule rule for ${assessmentName} at ${visitName} — unresolved entity references.`);
    return null;
  }
  return {
    id: slugId('rule', `${assessmentName}-${visitName}`),
    assessmentId,
    visitId,
    required: item.required ?? true,
    notes: item.notes ?? `${assessmentName} at ${visitName}`,
    sourceSectionIds: [evidence.sectionId],
    inferenceSource: resolveInferenceSource(item.inferenceSource),
    evidence: [evidence],
    rationale: item.rationale,
  };
}

export function sanitizeSoAEnrichmentResponse(
  response: SoAEnrichmentLlmResponse | null,
  sections: SoAProtocolSectionInput[],
  deterministicModel: SoAKnowledgeModel,
) {
  const diagnostics: string[] = [];
  const warnings = [...(response?.warnings ?? [])];
  const missingEvidenceWarnings: string[] = [];
  const unsupportedInferenceWarnings: string[] = [];
  const hallucinationRiskWarnings: string[] = [];
  const conflictingScheduleStatements: string[] = [];

  if (!response) {
    return {
      proposedVisits: [] as SoAEnrichedVisit[],
      proposedAssessments: [] as SoAEnrichedAssessment[],
      proposedProcedures: [] as SoAEnrichmentProposal['proposedProcedures'],
      proposedActivities: [] as SoAEnrichmentProposal['proposedActivities'],
      proposedConditions: [] as SoAEnrichedCondition[],
      proposedTimingWindows: [] as SoAEnrichedTimingWindow[],
      proposedScheduleRules: [] as SoAEnrichedScheduleRule[],
      proposedFootnotes: [] as SoAEnrichmentProposal['proposedFootnotes'],
      rationaleEntries: [] as SoAEnrichmentRationaleEntry[],
      diagnostics: ['Malformed LLM enrichment JSON — proposal created with deterministic baseline only.'],
      warnings,
      hallucinationRiskWarnings,
      unsupportedInferenceWarnings,
      missingEvidenceWarnings,
      conflictingScheduleStatements,
      discardedCount: 0,
    };
  }

  const existingVisitNames = new Set(deterministicModel.visits.map((visit) => normalizeSoAName(visit.name)));
  const existingAssessmentNames = new Set(deterministicModel.assessments.map((assessment) => normalizeSoAName(assessment.name)));
  const existingConditionLabels = new Set(deterministicModel.conditions.map((condition) => normalizeSoAName(condition.label)));
  const existingTimingLabels = new Set(deterministicModel.timingWindows.map((window) => normalizeSoAName(window.label)));

  let discardedCount = 0;
  const proposedVisits = (response.visits ?? [])
    .map((item) => mapNamedVisit(item, sections, existingVisitNames, diagnostics))
    .filter((item): item is SoAEnrichedVisit => {
      if (!item) {
        discardedCount += 1;
        return false;
      }
      existingVisitNames.add(normalizeSoAName(item.name));
      return true;
    });

  const proposedAssessments = (response.assessments ?? [])
    .map((item) => mapNamedAssessment(item, sections, existingAssessmentNames, diagnostics))
    .filter((item): item is SoAEnrichedAssessment => {
      if (!item) {
        discardedCount += 1;
        return false;
      }
      existingAssessmentNames.add(normalizeSoAName(item.name));
      return true;
    });

  const proposedTimingWindows = (response.timingWindows ?? [])
    .map((item) => mapTimingWindow(item, sections, existingTimingLabels, diagnostics))
    .filter((item): item is SoAEnrichedTimingWindow => {
      if (!item) {
        discardedCount += 1;
        return false;
      }
      existingTimingLabels.add(normalizeSoAName(item.label));
      return true;
    });

  const proposedConditions = (response.conditions ?? [])
    .map((item) => mapCondition(item, sections, existingConditionLabels, diagnostics))
    .filter((item): item is SoAEnrichedCondition => {
      if (!item) {
        discardedCount += 1;
        return false;
      }
      existingConditionLabels.add(normalizeSoAName(item.label));
      return true;
    });

  const visitNameMap = new Map([
    ...deterministicModel.visits.map((visit) => [normalizeSoAName(visit.name), visit.id] as const),
    ...proposedVisits.map((visit) => [normalizeSoAName(visit.name), visit.id] as const),
  ]);
  const assessmentNameMap = new Map([
    ...deterministicModel.assessments.map((assessment) => [normalizeSoAName(assessment.name), assessment.id] as const),
    ...proposedAssessments.map((assessment) => [normalizeSoAName(assessment.name), assessment.id] as const),
  ]);

  const proposedScheduleRules = (response.scheduleRules ?? [])
    .map((item) => mapScheduleRule(item, sections, visitNameMap, assessmentNameMap, diagnostics))
    .filter((item): item is SoAEnrichedScheduleRule => {
      if (!item) {
        discardedCount += 1;
        return false;
      }
      return true;
    });

  for (const item of [...(response.visits ?? []), ...(response.assessments ?? []), ...(response.timingWindows ?? [])]) {
    if (!item.sourceText?.trim() || !item.sectionId?.trim()) {
      missingEvidenceWarnings.push(`Missing evidence for proposed item "${item.name ?? item.label ?? 'unknown'}".`);
    }
  }

  const rationaleEntries: SoAEnrichmentRationaleEntry[] = (response.rationale ?? [])
    .filter((entry) => entry.itemKind && entry.itemName && entry.rationale)
    .map((entry) => ({
      itemKind: entry.itemKind!,
      itemName: entry.itemName!,
      rationale: entry.rationale!,
      inferenceSource: entry.inferenceSource ?? 'llm-inferred',
    }));

  return {
    proposedVisits,
    proposedAssessments,
    proposedProcedures: [],
    proposedActivities: [],
    proposedConditions,
    proposedTimingWindows,
    proposedScheduleRules,
    proposedFootnotes: [],
    rationaleEntries,
    diagnostics,
    warnings,
    hallucinationRiskWarnings,
    unsupportedInferenceWarnings,
    missingEvidenceWarnings,
    conflictingScheduleStatements,
    discardedCount,
  };
}

export function buildSoAEnrichmentProposal(
  input: SoAEnrichmentInput,
  response: SoAEnrichmentLlmResponse | null,
  provider: string,
  model?: string,
): SoAEnrichmentBuildResult {
  const sanitized = sanitizeSoAEnrichmentResponse(response, input.protocolSections, input.deterministicModel);
  const now = new Date().toISOString();
  const sourceSectionIds = [
    ...new Set([
      ...input.deterministicModel.sourceSectionIds,
      ...sanitized.proposedVisits.flatMap((item) => item.sourceSectionIds),
      ...sanitized.proposedAssessments.flatMap((item) => item.sourceSectionIds),
      ...sanitized.proposedConditions.flatMap((item) => item.sourceSectionIds),
      ...sanitized.proposedTimingWindows.flatMap((item) => item.sourceSectionIds),
      ...sanitized.proposedScheduleRules.flatMap((item) => item.sourceSectionIds),
    ]),
  ];

  const partialProposal = {
    proposedVisits: sanitized.proposedVisits,
    proposedAssessments: sanitized.proposedAssessments,
    proposedProcedures: sanitized.proposedProcedures,
    proposedActivities: sanitized.proposedActivities,
    proposedConditions: sanitized.proposedConditions,
    proposedTimingWindows: sanitized.proposedTimingWindows,
    proposedScheduleRules: sanitized.proposedScheduleRules,
    proposedFootnotes: sanitized.proposedFootnotes,
  };

  const enrichedCounts = countEnrichmentProposalItems(partialProposal);
  const proposal: SoAEnrichmentProposal = {
    id: `soa-enrichment-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    provider,
    model,
    status: 'proposed',
    summary:
      enrichedCounts.visits + enrichedCounts.assessments + enrichedCounts.scheduleRules + enrichedCounts.conditions + enrichedCounts.timingWindows > 0
        ? `LLM enrichment proposes ${enrichedCounts.visits} visit(s), ${enrichedCounts.assessments} assessment(s), ${enrichedCounts.scheduleRules} rule(s)`
        : 'No additional enrichment items passed evidence validation',
    deterministicCounts: buildDeterministicCounts(input.deterministicModel),
    enrichedCounts,
    ...partialProposal,
    diagnostics: sanitized.diagnostics,
    warnings: sanitized.warnings,
    hallucinationRiskWarnings: sanitized.hallucinationRiskWarnings,
    unsupportedInferenceWarnings: sanitized.unsupportedInferenceWarnings,
    missingEvidenceWarnings: sanitized.missingEvidenceWarnings,
    conflictingScheduleStatements: sanitized.conflictingScheduleStatements,
    rationaleEntries: sanitized.rationaleEntries,
    sourceSectionIds,
    impactedNarrativeSections: buildImpactedNarrativeSections(partialProposal),
  };

  return { proposal, discardedCount: sanitized.discardedCount };
}

export async function runSoAEnrichmentProvider(input: SoAEnrichmentInput): Promise<{
  response: SoAEnrichmentLlmResponse | null;
  provider: string;
  model?: string;
  error?: string;
}> {
  const config = resolveLlmProviderConfig();
  const provider = config.providerId;

  if (provider === 'fixture' || provider === 'local' || !config.apiKey) {
    return {
      response: buildFixtureSoAEnrichmentResponse(input.protocolSections, input.deterministicModel),
      provider: 'fixture',
      model: 'soa-enrichment-fixture-v1',
    };
  }

  const prompt = buildSoAEnrichmentPrompt(input);
  try {
    const completion = await callOpenAiChat(
      config,
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      { jsonMode: true },
    );
    const parsed = parseSoAEnrichmentLlmResponse(completion.content);
    return {
      response: parsed,
      provider,
      model: config.model,
      error: parsed ? undefined : 'Malformed LLM enrichment JSON',
    };
  } catch (error) {
    return {
      response: buildFixtureSoAEnrichmentResponse(input.protocolSections, input.deterministicModel),
      provider: 'fixture',
      model: 'soa-enrichment-fixture-v1',
      error: error instanceof Error ? error.message : 'LLM enrichment failed — fixture fallback used',
    };
  }
}
