import { getProtocolDocument } from '../protocol/store/protocolStore';
import type { ProtocolDocument } from '../protocol/types';
import type { GeneratedSectionDraft } from '../protocol/import/types';
import { appendProtocolBuildEvent } from '../protocol/build/protocolBuildConsoleStore';
import { patchSoAKnowledge, setSoAKnowledge } from './soaKnowledgeStore';
import { applySoAKnowledgePatch, createEmptySoAKnowledgeModel, normalizeSoAName } from './soaKnowledgePatch';
import type {
  SoAAssessment,
  SoAAssessmentCategory,
  SoAArm,
  SoACondition,
  SoAEpoch,
  SoAFootnote,
  SoAKnowledgeModel,
  SoAConfigurationComparison,
  SoAProtocolSectionInput,
  SoAScheduleRule,
  SoATimingUnit,
  SoATimingWindow,
  SoAVisit,
} from './soaKnowledgeTypes';

const SOA_RELEVANT_SECTION_IDS = ['1.3', '4', '6', '8', '9', '10'] as const;

const VISIT_PATTERNS: RegExp[] = [
  /\b(cycle\s*\d+\s*day\s*\d+)\b/gi,
  /\b(day\s*\d+)\b/gi,
  /\b(week\s*\d+)\b/gi,
  /\b(visit\s*\d+[a-z]?)\b/gi,
  /\b(screening|baseline|randomization|end of (?:study|treatment)|follow[- ]?up|eos|eot)\b/gi,
];

const CONDITION_PATTERNS: RegExp[] = [
  /\bif clinically indicated\b/gi,
  /\bas (?:clinically )?indicated\b/gi,
  /\bwhen (?:clinically )?indicated\b/gi,
  /\bper investigator (?:discretion|judgment)\b/gi,
];

const TIMING_WINDOW_PATTERNS: RegExp[] = [
  new RegExp(String.raw`\b(?:±|\+/-)\s*(\d+)\s*(day|days|week|weeks|hour|hours)\b`, 'gi'),
  /\bwithin\s+(\d+)\s*(day|days|week|weeks)\s+(?:of|before|after)\b/gi,
];

const ASSESSMENT_CATALOG: Array<{ pattern: RegExp; name: string; category: SoAAssessmentCategory }> = [
  { pattern: /\badverse events?\b/gi, name: 'Adverse Events', category: 'adverseEvents' },
  { pattern: /\bsae[s]?\b|\bserious adverse events?\b/gi, name: 'Serious Adverse Events', category: 'safety' },
  { pattern: /\bvital signs?\b/gi, name: 'Vital Signs', category: 'vitalSigns' },
  { pattern: /\bphysical examinations?\b/gi, name: 'Physical Examination', category: 'physicalExam' },
  { pattern: /\b(?:clinical )?laboratory(?: tests?)?\b|\bhematology\b|\bchemistry\b/gi, name: 'Laboratory Assessments', category: 'laboratory' },
  { pattern: /\b(?:mri|ct scan|pet scan|imaging)\b/gi, name: 'Imaging', category: 'imaging' },
  { pattern: /\becg\b|\belectrocardiogram\b/gi, name: 'Electrocardiogram', category: 'safety' },
  { pattern: /\bconcomitant medications?\b/gi, name: 'Concomitant Medications', category: 'concomitantMedication' },
  { pattern: /\bpharmacokinetic[s]?\b|\bpk sampling\b/gi, name: 'Pharmacokinetics', category: 'pk' },
  { pattern: /\bpatient[- ]reported outcomes?\b|\bpro[s]?\b|\bquestionnaires?\b/gi, name: 'Patient-Reported Outcomes', category: 'pro' },
  { pattern: /\befficacy assessments?\b/gi, name: 'Efficacy Assessments', category: 'efficacy' },
];

function slugId(prefix: string, value: string): string {
  const slug = normalizeSoAName(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${prefix}-${slug || 'item'}`;
}

function safeText(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\r\n/g, '\n').trim();
}

function isRelevantSection(sectionId: string): boolean {
  return SOA_RELEVANT_SECTION_IDS.some(
    (candidate) => sectionId === candidate || sectionId.startsWith(`${candidate}.`),
  );
}

function parseTimingUnit(raw: string): SoATimingUnit {
  const normalized = raw.toLowerCase();
  if (normalized.startsWith('hour')) return 'hours';
  if (normalized.startsWith('week')) return 'weeks';
  if (normalized.startsWith('month')) return 'months';
  if (normalized.startsWith('cycle')) return 'cycles';
  return 'days';
}

function extractVisits(text: string, sectionId: string): SoAVisit[] {
  const visits: SoAVisit[] = [];
  const seen = new Set<string>();
  let order = 0;

  for (const pattern of VISIT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1]?.trim() ?? match[0]?.trim();
      if (!name) continue;
      const key = normalizeSoAName(name);
      if (seen.has(key)) continue;
      seen.add(key);

      const nominalDayMatch = /day\s*(\d+)/i.exec(name);
      const nominalWeekMatch = /week\s*(\d+)/i.exec(name);
      visits.push({
        id: slugId('visit', name),
        name: name.replace(/\b\w/g, (char, index) => (index === 0 ? char.toUpperCase() : char)),
        nominalDay: nominalDayMatch ? Number(nominalDayMatch[1]) : undefined,
        nominalWeek: nominalWeekMatch ? Number(nominalWeekMatch[1]) : undefined,
        order: order++,
        sourceSectionIds: [sectionId],
      });
    }
  }

  return visits;
}

function extractAssessments(text: string, sectionId: string): SoAAssessment[] {
  const assessments: SoAAssessment[] = [];
  const seen = new Set<string>();

  for (const entry of ASSESSMENT_CATALOG) {
    entry.pattern.lastIndex = 0;
    if (!entry.pattern.test(text)) {
      continue;
    }
    const key = normalizeSoAName(entry.name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    assessments.push({
      id: slugId('assessment', entry.name),
      name: entry.name,
      category: entry.category,
      sourceSectionIds: [sectionId],
    });
  }

  return assessments;
}

function extractArms(text: string, sectionId: string): SoAArm[] {
  const arms: SoAArm[] = [];
  const armPattern = /\b(?:treatment|study|experimental|control|placebo)\s+arm[s]?\b[^.\n]*/gi;
  let match: RegExpExecArray | null;
  while ((match = armPattern.exec(text)) !== null) {
    const name = match[0].trim().slice(0, 120);
    if (name.length < 5) continue;
    arms.push({
      id: slugId('arm', name),
      name,
      sourceSectionIds: [sectionId],
    });
  }
  return arms;
}

function extractEpochs(text: string, sectionId: string): SoAEpoch[] {
  const epochs: SoAEpoch[] = [];
  const epochPattern = /\b(screening|treatment|follow[- ]?up|maintenance|induction|consolidation)\s+(?:phase|epoch|period)\b/gi;
  let order = 0;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = epochPattern.exec(text)) !== null) {
    const name = match[0].trim();
    const key = normalizeSoAName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    epochs.push({
      id: slugId('epoch', name),
      name,
      order: order++,
      sourceSectionIds: [sectionId],
    });
  }
  return epochs;
}

function extractConditions(text: string, sectionId: string): SoACondition[] {
  const conditions: SoACondition[] = [];
  for (const pattern of CONDITION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const label = match[0].trim();
      conditions.push({
        id: slugId('condition', label),
        label,
        expressionText: label,
        sourceSectionIds: [sectionId],
      });
    }
  }
  return conditions;
}

function extractTimingWindows(text: string, sectionId: string): {
  windows: SoATimingWindow[];
  unmapped: string[];
  ambiguous: string[];
} {
  const windows: SoATimingWindow[] = [];
  const unmapped: string[] = [];
  const ambiguous: string[] = [];

  for (const pattern of TIMING_WINDOW_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const label = match[0].trim();
      const amount = Number(match[1]);
      if (!Number.isFinite(amount)) {
        ambiguous.push(`${sectionId}: ${label}`);
        continue;
      }
      windows.push({
        id: slugId('timing', label),
        label,
        offset: amount,
        unit: parseTimingUnit(match[2] ?? 'days'),
        windowBefore: amount,
        windowAfter: amount,
        sourceSectionIds: [sectionId],
      });
    }
  }

  const vagueTiming = /\b(?:approximately|about|around)\s+\d+\s+(?:days?|weeks?)\b/gi;
  vagueTiming.lastIndex = 0;
  let vagueMatch: RegExpExecArray | null;
  while ((vagueMatch = vagueTiming.exec(text)) !== null) {
    ambiguous.push(`${sectionId}: ${vagueMatch[0].trim()}`);
  }

  const orphanTiming = /\b(?:day|week|cycle)\s+\d+\b(?![^.\n]{0,40}(?:visit|assessment|performed|conducted))/gi;
  orphanTiming.lastIndex = 0;
  let orphanMatch: RegExpExecArray | null;
  while ((orphanMatch = orphanTiming.exec(text)) !== null) {
    unmapped.push(`${sectionId}: ${orphanMatch[0].trim()}`);
  }

  return { windows, unmapped, ambiguous };
}

function extractFootnotes(text: string, sectionId: string): SoAFootnote[] {
  const footnotes: SoAFootnote[] = [];
  const footnotePattern = /(?:^|\n)\s*(?:\*+|†+|Footnote\s*\d+[:.]?)\s*([^\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = footnotePattern.exec(text)) !== null) {
    const textValue = match[1]?.trim();
    if (!textValue || textValue.length < 8) continue;
    footnotes.push({
      id: slugId('footnote', textValue.slice(0, 40)),
      label: textValue.slice(0, 40),
      text: textValue,
      appliesToIds: [],
      sourceSectionIds: [sectionId],
    });
  }
  return footnotes;
}

function extractExplicitScheduleRules(
  text: string,
  sectionId: string,
  visits: SoAVisit[],
  assessments: SoAAssessment[],
): { rules: SoAScheduleRule[]; ambiguous: string[] } {
  const rules: SoAScheduleRule[] = [];
  const ambiguous: string[] = [];

  for (const assessment of assessments) {
    const atEachVisit = new RegExp(
      `${assessment.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.\\n]{0,80}\\bat each visit\\b`,
      'i',
    );
    if (atEachVisit.test(text) && visits.length > 0) {
      for (const visit of visits) {
        rules.push({
          id: slugId('rule', `${assessment.id}-${visit.id}`),
          assessmentId: assessment.id,
          visitId: visit.id,
          required: true,
          sourceSectionIds: [sectionId],
          notes: 'Explicit "at each visit" language',
        });
      }
      continue;
    }

    for (const visit of visits) {
      const explicitAtVisit = new RegExp(
        `${assessment.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.\\n]{0,60}\\bat\\s+${visit.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      );
      if (explicitAtVisit.test(text)) {
        rules.push({
          id: slugId('rule', `${assessment.id}-${visit.id}`),
          assessmentId: assessment.id,
          visitId: visit.id,
          required: true,
          sourceSectionIds: [sectionId],
          notes: `Explicit scheduling at ${visit.name}`,
        });
      }
    }
  }

  if (/\bschedule of activities\b/i.test(text) && assessments.length > 0 && visits.length === 0) {
    ambiguous.push(`${sectionId}: SoA references assessments but no explicit visit anchors were found`);
  }

  return { rules, ambiguous };
}

export function buildSoAKnowledgeFromProtocolSections(
  sections: SoAProtocolSectionInput[],
  protocolId?: string,
): SoAKnowledgeModel {
  const model = createEmptySoAKnowledgeModel(protocolId);
  if (!sections?.length) {
    model.extractionNotes.push('No protocol sections supplied — empty SoA Knowledge Model created safely.');
    return model;
  }

  const arms: SoAArm[] = [];
  const epochs: SoAEpoch[] = [];
  const visits: SoAVisit[] = [];
  const assessments: SoAAssessment[] = [];
  const conditions: SoACondition[] = [];
  const timingWindows: SoATimingWindow[] = [];
  const footnotes: SoAFootnote[] = [];
  const scheduleRules: SoAScheduleRule[] = [];
  const extractionNotes: string[] = [];
  const unmappedTimingReferences: string[] = [];
  const ambiguousScheduleStatements: string[] = [];
  const sourceSectionIds: string[] = [];

  for (const section of sections) {
    const text = safeText(section.text);
    if (!text) {
      continue;
    }
    if (!isRelevantSection(section.sectionId)) {
      continue;
    }

    sourceSectionIds.push(section.sectionId);
    arms.push(...extractArms(text, section.sectionId));
    epochs.push(...extractEpochs(text, section.sectionId));
    visits.push(...extractVisits(text, section.sectionId));
    assessments.push(...extractAssessments(text, section.sectionId));
    conditions.push(...extractConditions(text, section.sectionId));
    footnotes.push(...extractFootnotes(text, section.sectionId));

    const timing = extractTimingWindows(text, section.sectionId);
    timingWindows.push(...timing.windows);
    unmappedTimingReferences.push(...timing.unmapped);
    ambiguousScheduleStatements.push(...timing.ambiguous);

    const sectionAssessments = extractAssessments(text, section.sectionId);
    const sectionVisits = extractVisits(text, section.sectionId);
    const explicitRules = extractExplicitScheduleRules(
      text,
      section.sectionId,
      sectionVisits,
      sectionAssessments,
    );
    scheduleRules.push(...explicitRules.rules);
    ambiguousScheduleStatements.push(...explicitRules.ambiguous);
  }

  if (visits.length === 0 && assessments.length > 0) {
    extractionNotes.push('Assessments extracted without resolvable visit anchors — schedule rules not inferred.');
  }

  return applySoAKnowledgePatch(model, {
    arms,
    epochs,
    visits,
    assessments,
    conditions,
    timingWindows,
    footnotes,
    scheduleRules,
    sourceSectionIds: [...new Set(sourceSectionIds)],
    extractionNotes,
    unmappedTimingReferences,
    ambiguousScheduleStatements,
  });
}

export function buildSoAKnowledgeFromExistingConfiguration(
  document: ProtocolDocument = getProtocolDocument(),
  protocolId?: string,
): SoAKnowledgeModel {
  const model = createEmptySoAKnowledgeModel(protocolId ?? document.id);

  model.arms = (document.clinicalDesign.studyArms ?? []).map((arm, index) => ({
    id: arm.id ?? slugId('arm', arm.name ?? `arm-${index + 1}`),
    name: arm.name ?? `Arm ${index + 1}`,
    description: arm.description,
    sourceSectionIds: arm.sectionRef ? [arm.sectionRef] : [],
  }));

  const epochNames = new Set<string>();
  for (const visit of document.visitSchedule.visitDefinitions ?? []) {
    if (visit.epoch) {
      epochNames.add(visit.epoch);
    }
  }
  model.epochs = [...epochNames].map((name, index) => ({
    id: slugId('epoch', name),
    name,
    order: index,
    sourceSectionIds: [],
  }));

  model.visits = (document.visitSchedule.visitDefinitions ?? []).map((visit) => ({
    id: visit.id,
    name: visit.displayLabel ?? visit.name,
    epochId: visit.epoch ? slugId('epoch', visit.epoch) : undefined,
    nominalDay: visit.nominalDay ?? visit.offsetDays,
    nominalWeek: visit.nominalWeek ?? visit.offsetWeeks,
    window:
      visit.windowBeforeDays !== undefined || visit.windowAfterDays !== undefined
        ? `-${visit.windowBeforeDays ?? 0}/+${visit.windowAfterDays ?? 0} days`
        : undefined,
    order: visit.order,
    sourceSectionIds: visit.metadata?.sourceSectionIds
      ? (visit.metadata.sourceSectionIds as string[])
      : [],
  }));

  model.assessments = (document.soaAssessmentDefinitions ?? []).map((assessment) => ({
    id: assessment.id,
    name: assessment.label,
    category: mapConfigurationCategory(assessment.category),
    sourceSectionIds: assessment.linkedSectionId ? [assessment.linkedSectionId] : [],
  }));

  model.scheduleRules = (document.assessmentScheduleRules ?? []).map((rule) => ({
    id: rule.id,
    assessmentId: rule.assessmentId,
    visitId: rule.visitDefinitionId,
    required: rule.required,
    sourceSectionIds: rule.sourceSectionId ? [rule.sourceSectionId] : [],
    notes: rule.timingNote,
  }));

  model.extractionNotes.push(
    'Built from existing SoA Configuration — narrative extraction not applied in this pass.',
  );
  model.updatedAt = new Date().toISOString();
  return model;
}

function mapConfigurationCategory(category: string): SoAAssessment['category'] {
  const normalized = category.toLowerCase();
  if (normalized.includes('safety')) return 'safety';
  if (normalized.includes('efficacy')) return 'efficacy';
  if (normalized.includes('lab')) return 'laboratory';
  if (normalized.includes('vital')) return 'vitalSigns';
  if (normalized.includes('imaging')) return 'imaging';
  if (normalized.includes('pk')) return 'pk';
  if (normalized.includes('pro')) return 'pro';
  return 'other';
}

/** @deprecated Use applySoAConfigurationPatchSafely from soaConfigurationPatch. */
export { applySoAKnowledgeToExistingConfiguration } from './soaConfigurationPatch';

export function compareSoAKnowledgeToExistingConfiguration(
  knowledge: SoAKnowledgeModel,
  document: ProtocolDocument = getProtocolDocument(),
): SoAConfigurationComparison {
  const configAssessments = document.soaAssessmentDefinitions ?? [];
  const configVisits = document.visitSchedule.visitDefinitions ?? [];
  const configArms = document.clinicalDesign.studyArms ?? [];
  const configRules = document.assessmentScheduleRules ?? [];

  const configAssessmentNames = new Set(configAssessments.map((item) => normalizeSoAName(item.label)));
  const knowledgeAssessmentNames = new Set(knowledge.assessments.map((item) => normalizeSoAName(item.name)));

  const matchedAssessments = knowledge.assessments.filter((item) =>
    configAssessmentNames.has(normalizeSoAName(item.name)),
  ).length;

  const matchedVisits = knowledge.visits.filter((visit) =>
    configVisits.some(
      (configVisit) => normalizeSoAName(configVisit.name) === normalizeSoAName(visit.name),
    ),
  ).length;

  return {
    arms: {
      knowledge: knowledge.arms.length,
      configuration: configArms.length,
      matched: knowledge.arms.filter((arm) =>
        configArms.some((configArm) => normalizeSoAName(configArm.name) === normalizeSoAName(arm.name)),
      ).length,
    },
    visits: {
      knowledge: knowledge.visits.length,
      configuration: configVisits.length,
      matched: matchedVisits,
    },
    assessments: {
      knowledge: knowledge.assessments.length,
      configuration: configAssessments.length,
      matched: matchedAssessments,
    },
    scheduleRules: {
      knowledge: knowledge.scheduleRules.length,
      configuration: configRules.length,
      matched: knowledge.scheduleRules.filter((rule) =>
        configRules.some(
          (configRule) =>
            configRule.assessmentId === rule.assessmentId &&
            configRule.visitDefinitionId === rule.visitId,
        ),
      ).length,
    },
    unmatchedKnowledgeAssessments: knowledge.assessments
      .filter((item) => !configAssessmentNames.has(normalizeSoAName(item.name)))
      .map((item) => item.name),
    unmatchedConfigurationAssessments: configAssessments
      .filter((item) => !knowledgeAssessmentNames.has(normalizeSoAName(item.label)))
      .map((item) => item.label),
  };
}

export function sectionsFromImportDrafts(
  drafts: Record<string, GeneratedSectionDraft>,
): SoAProtocolSectionInput[] {
  return Object.values(drafts ?? {})
    .filter((draft) => safeText(draft.generatedText).length > 0)
    .map((draft) => ({
      sectionId: draft.sectionId,
      title: draft.title,
      text: safeText(draft.generatedText),
    }));
}

export function refreshSoAKnowledgeFromImport(options: {
  drafts: Record<string, GeneratedSectionDraft>;
  protocolId?: string;
  mergeWithConfiguration?: boolean;
}): SoAKnowledgeModel {
  appendProtocolBuildEvent({ type: 'progress', message: 'Building SoA Knowledge Model' });

  const narrativeModel = buildSoAKnowledgeFromProtocolSections(
    sectionsFromImportDrafts(options.drafts),
    options.protocolId,
  );

  let merged = narrativeModel;
  if (options.mergeWithConfiguration) {
    const configModel = buildSoAKnowledgeFromExistingConfiguration(undefined, options.protocolId);
    merged = {
      ...narrativeModel,
      arms: [...narrativeModel.arms, ...configModel.arms],
      epochs: [...narrativeModel.epochs, ...configModel.epochs],
      visits: [...narrativeModel.visits, ...configModel.visits],
      assessments: [...narrativeModel.assessments, ...configModel.assessments],
      scheduleRules: [...narrativeModel.scheduleRules, ...configModel.scheduleRules],
      extractionNotes: [
        ...narrativeModel.extractionNotes,
        'Merged with existing SoA Configuration entities (read-only bridge).',
      ],
    };
  }

  const stored = setSoAKnowledge(merged);

  appendProtocolBuildEvent({
    type: 'success',
    message: `Extracted ${stored.visits.length} visits`,
    metadata: { visitCount: stored.visits.length },
  });
  appendProtocolBuildEvent({
    type: 'success',
    message: `Extracted ${stored.assessments.length} assessments`,
    metadata: { assessmentCount: stored.assessments.length },
  });
  appendProtocolBuildEvent({
    type: 'success',
    message: `Extracted ${stored.scheduleRules.length} schedule rules`,
    metadata: { scheduleRuleCount: stored.scheduleRules.length },
  });
  appendProtocolBuildEvent({ type: 'success', message: 'SoA Knowledge Model updated' });

  return stored;
}

export function mergeExtractedSoAKnowledgeIntoStore(
  sections: SoAProtocolSectionInput[],
  protocolId?: string,
): SoAKnowledgeModel {
  const extracted = buildSoAKnowledgeFromProtocolSections(sections, protocolId);
  return patchSoAKnowledge(extracted);
}
