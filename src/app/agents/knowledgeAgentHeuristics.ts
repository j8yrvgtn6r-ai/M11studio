import type { StudyModelCollectionKey, StudyModelItem } from '../domain/study-model/studyModelTypes';
import type { StudyModelPatch } from '../domain/study-model/studyModelPatch';
import type { KnowledgeEntity, KnowledgeRelationship } from '../domain/knowledge-graph/knowledgeGraphTypes';
import { extractKnowledgeGraphFromSection } from '../domain/knowledge-graph/knowledgeGraphExtraction';

export type KnowledgeAgentTextSource = 'imported' | 'generated' | 'edited' | 'validated' | 'reviewed';

export interface KnowledgeAgentInput {
  sectionId: string;
  sectionTitle: string;
  currentText: string;
  previousText?: string;
  source: KnowledgeAgentTextSource;
}

export interface KnowledgeExtractedItem {
  collection: StudyModelCollectionKey | 'studyMetadata';
  metadataField?: 'title' | 'phase' | 'indication';
  name: string;
  description?: string;
}

export interface KnowledgeAgentOutput {
  extractedItems: KnowledgeExtractedItem[];
  changedItems: KnowledgeExtractedItem[];
  affectedSectionIds: string[];
  studyModelPatch: StudyModelPatch;
  knowledgeEntities: KnowledgeEntity[];
  knowledgeRelationships: KnowledgeRelationship[];
  notes: string[];
}

function slug(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base ? `${base}-${index}` : `item-${index}`;
}

function item(
  collection: StudyModelCollectionKey,
  name: string,
  sectionId: string,
  index: number,
  description?: string,
): StudyModelItem {
  return {
    id: `${collection}-${slug(name, index)}`,
    name: name.trim(),
    description: description?.trim() || name.trim(),
    sourceSections: [sectionId],
    lastUpdated: new Date().toISOString(),
  };
}

function extractLinesMatching(text: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    for (const pattern of patterns) {
      const match = pattern.exec(trimmed);
      if (match?.[1]?.trim()) {
        results.push(match[1].trim());
        break;
      }
      if (pattern.test(trimmed) && trimmed.length > 12) {
        results.push(trimmed.replace(/^[-•*\d.()\s]+/, '').trim());
        break;
      }
    }
  }
  return [...new Set(results.filter(Boolean))];
}

function extractBulletItems(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => /^[-•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
        .map((line) => line.replace(/^[-•*\d.()\s]+/, '').trim())
        .filter((line) => line.length > 8),
    ),
  ];
}

function extractSectionPrefix(sectionId: string): string {
  return sectionId.split('.')[0] ?? sectionId;
}

function extractMetadata(text: string): StudyModelPatch['studyMetadata'] {
  const metadata: NonNullable<StudyModelPatch['studyMetadata']> = {};
  const titleMatch = /(?:study title|protocol title|title)\s*[:\-]\s*(.+)/i.exec(text);
  if (titleMatch?.[1]?.trim()) {
    metadata.title = titleMatch[1].trim();
  }
  const phaseMatch = /phase\s+([IVX0-9/+-]+(?:\s*\/\s*[IVX0-9/+-]+)?)/i.exec(text);
  if (phaseMatch?.[1]?.trim()) {
    metadata.phase = phaseMatch[1].trim();
  }
  const indicationMatch = /(?:indication|disease)\s*[:\-]\s*(.+)/i.exec(text);
  if (indicationMatch?.[1]?.trim()) {
    metadata.indication = indicationMatch[1].trim().slice(0, 240);
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function extractSampleSize(text: string): string | undefined {
  const match =
    /sample size[^.\n]{0,40}?(\d[\d,]*(?:\s*(?:participants|subjects|patients))?)/i.exec(text) ??
    /(\d[\d,]*)\s+(?:participants|subjects|patients)\s+(?:will be|are planned)/i.exec(text);
  return match?.[1]?.trim();
}

export function extractKnowledgeFromSectionText(input: KnowledgeAgentInput): KnowledgeAgentOutput {
  const text = input.currentText.trim();
  const sectionId = input.sectionId;
  const prefix = extractSectionPrefix(sectionId);
  const extractedItems: KnowledgeExtractedItem[] = [];
  const notes: string[] = [];
  const patch: StudyModelPatch = { collections: {} };

  if (!text) {
    return {
      extractedItems: [],
      changedItems: [],
      affectedSectionIds: [],
      studyModelPatch: {},
      knowledgeEntities: [],
      knowledgeRelationships: [],
      notes: ['Skipped empty section text.'],
    };
  }

  const metadata = extractMetadata(text);
  if (metadata) {
    patch.studyMetadata = metadata;
    for (const [field, value] of Object.entries(metadata)) {
      if (value) {
        extractedItems.push({
          collection: 'studyMetadata',
          metadataField: field as KnowledgeExtractedItem['metadataField'],
          name: value,
        });
      }
    }
  }

  const primaryObjectives = extractLinesMatching(text, [
    /^primary objective[s]?\s*[:\-]\s*(.+)/i,
    /^the primary objective (?:is|was)\s+(?:to\s+)?(.+)/i,
  ]);
  const secondaryObjectives = extractLinesMatching(text, [
    /^secondary objective[s]?\s*[:\-]\s*(.+)/i,
  ]);
  const exploratoryObjectives = extractLinesMatching(text, [
    /^exploratory objective[s]?\s*[:\-]\s*(.+)/i,
  ]);
  const endpoints = extractLinesMatching(text, [
    /^primary endpoint[s]?\s*[:\-]\s*(.+)/i,
    /^secondary endpoint[s]?\s*[:\-]\s*(.+)/i,
    /^key secondary endpoint[s]?\s*[:\-]\s*(.+)/i,
  ]);
  const inclusion = extractLinesMatching(text, [
    /^inclusion criteria?\s*[:\-]\s*(.+)/i,
    /^participants (?:must|will)\s+(.+)/i,
  ]);
  const exclusion = extractLinesMatching(text, [
    /^exclusion criteria?\s*[:\-]\s*(.+)/i,
    /^participants (?:must not|will not)\s+(.+)/i,
  ]);
  const arms = extractLinesMatching(text, [
    /^arm\s+[A-Z0-9]+\s*[:\-]\s*(.+)/i,
    /^(?:experimental|control|placebo|active comparator)\s+arm\s*[:\-]\s*(.+)/i,
  ]);
  const interventions = extractLinesMatching(text, [
    /^(?:investigational|study|test) (?:product|intervention|drug)\s*[:\-]\s*(.+)/i,
    /^intervention[s]?\s*[:\-]\s*(.+)/i,
  ]);
  const randomization = extractLinesMatching(text, [/^randomi[sz]ation\s*[:\-]\s*(.+)/i]);
  const blinding = extractLinesMatching(text, [/^blinding\s*[:\-]\s*(.+)/i, /^masking\s*[:\-]\s*(.+)/i]);
  const safety = extractLinesMatching(text, [
    /^safety assessment[s]?\s*[:\-]\s*(.+)/i,
    /^adverse event[s]?\s*[:\-]\s*(.+)/i,
  ]);
  const efficacy = extractLinesMatching(text, [
    /^efficacy assessment[s]?\s*[:\-]\s*(.+)/i,
    /^efficacy endpoint[s]?\s*[:\-]\s*(.+)/i,
  ]);
  const population = extractLinesMatching(text, [
    /^(?:study )?population\s*[:\-]\s*(.+)/i,
    /^target population\s*[:\-]\s*(.+)/i,
  ]);

  const bulletItems = extractBulletItems(text);
  const sampleSize = extractSampleSize(text);

  const addCollection = (collection: StudyModelCollectionKey, values: string[]) => {
    if (values.length === 0) {
      return;
    }
    patch.collections![collection] = values.map((value, index) => item(collection, value, sectionId, index));
    for (const value of values) {
      extractedItems.push({ collection, name: value });
    }
  };

  if (prefix === '1' || sectionId.startsWith('1.')) {
    addCollection('objectives', [...primaryObjectives, ...secondaryObjectives, ...exploratoryObjectives]);
    addCollection('endpoints', endpoints);
    addCollection('population', population);
    addCollection('arms', arms);
    addCollection('interventions', interventions);
    addCollection('randomization', randomization);
    addCollection('blinding', blinding);
    addCollection('safetyMonitoring', safety);
    addCollection('assessments', efficacy);
    notes.push('Applied synopsis-level extraction heuristics.');
  }

  if (prefix === '3' || /objective|endpoint|estimand/i.test(input.sectionTitle)) {
    addCollection('objectives', [...primaryObjectives, ...secondaryObjectives, ...exploratoryObjectives, ...bulletItems]);
    addCollection('endpoints', endpoints);
    addCollection('estimands', extractLinesMatching(text, [/^estimand\s*[:\-]\s*(.+)/i]));
  }

  if (prefix === '4' || /design|randomi|blinding|schema/i.test(input.sectionTitle)) {
    addCollection('arms', [...arms, ...bulletItems.filter((line) => /arm|group|cohort/i.test(line))]);
    addCollection('randomization', randomization);
    addCollection('blinding', blinding);
    addCollection('interventions', interventions);
  }

  if (prefix === '5' || /population|eligibility|inclusion|exclusion/i.test(input.sectionTitle)) {
    addCollection('population', [...population, ...bulletItems.filter((line) => /participant|patient|subject/i.test(line))]);
    addCollection('eligibility', [...inclusion, ...exclusion, ...bulletItems]);
  }

  if (prefix === '6' || /intervention|investigational|dose|regimen/i.test(input.sectionTitle)) {
    addCollection('interventions', [...interventions, ...bulletItems]);
  }

  if (prefix === '8' || /assessment|procedure|schedule|visit/i.test(input.sectionTitle)) {
    addCollection('assessments', [...efficacy, ...bulletItems]);
    addCollection('procedures', bulletItems);
    addCollection('activities', bulletItems.filter((line) => /activity|procedure|visit/i.test(line)));
  }

  if (prefix === '9' || /safety|adverse|tolerability/i.test(input.sectionTitle)) {
    addCollection('safetyMonitoring', [...safety, ...bulletItems]);
    addCollection('assessments', efficacy);
  }

  if (prefix === '10' || /statistic|analysis|sample size/i.test(input.sectionTitle)) {
    if (sampleSize) {
      patch.collections!.statisticalMethods = [
        item('statisticalMethods', `Sample size: ${sampleSize}`, sectionId, 0, sampleSize),
      ];
      extractedItems.push({ collection: 'statisticalMethods', name: `Sample size: ${sampleSize}`, description: sampleSize });
    }
    addCollection(
      'statisticalMethods',
      extractLinesMatching(text, [/^statistical (?:analysis|method[s]?)\s*[:\-]\s*(.+)/i]),
    );
  }

  if (!patch.collections || Object.keys(patch.collections).length === 0) {
    if (primaryObjectives.length > 0) {
      addCollection('objectives', primaryObjectives);
    } else if (bulletItems.length > 0) {
      addCollection('objectives', bulletItems.slice(0, 3));
      notes.push('Fallback bullet extraction applied.');
    }
  }

  const changedItems = extractedItems.filter((entry) => {
    if (!input.previousText?.trim()) {
      return true;
    }
    const needle = entry.name.toLowerCase();
    return !input.previousText.toLowerCase().includes(needle);
  });

  const { knowledgeEntities, knowledgeRelationships } = extractKnowledgeGraphFromSection({
    sectionId,
    extractedItems,
  });

  return {
    extractedItems,
    changedItems,
    affectedSectionIds: extractedItems.length > 0 ? [sectionId] : [],
    studyModelPatch: patch,
    knowledgeEntities,
    knowledgeRelationships,
    notes,
  };
}
