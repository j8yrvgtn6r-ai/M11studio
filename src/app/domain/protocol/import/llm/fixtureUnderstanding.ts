import { buildLocalDeterministicKnowledgeModel } from '../buildProtocolKnowledgeModel';
import type { ProtocolKnowledgeModel } from '../protocolKnowledgeTypes';
import type { ProtocolUnderstandingInput } from './types';
import { UNDERSTANDING_PROMPT_VERSION } from './types';

function linesMatching(source: ProtocolUnderstandingInput['sourceExtraction'], pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const section of source.sourceExtraction.sections) {
    if (pattern.test(section.headingText) || pattern.test(section.text.slice(0, 300))) {
      hits.push(`${section.headingText}: ${section.text.replace(/\s+/g, ' ').trim().slice(0, 280)}`);
    }
  }
  if (hits.length === 0) {
    const fromText = source.sourceExtraction.fullText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => pattern.test(line))
      .slice(0, 4);
    hits.push(...fromText);
  }
  return [...new Set(hits)].slice(0, 6);
}

/**
 * Fixture protocol understanding — reconstruction from full protocol text.
 * Used for smoke/CI when no LLM API key is configured. Not a live model call.
 */
export function buildFixtureProtocolUnderstanding(
  input: ProtocolUnderstandingInput,
): ProtocolKnowledgeModel {
  const base = buildLocalDeterministicKnowledgeModel(input.sourceExtraction);
  const text = input.sourceExtraction.fullText;

  const sourceReferences = input.sourceExtraction.sections.slice(0, 8).map((section) => ({
    sourceSectionId: section.id,
    label: section.headingText,
    excerpt: section.text.slice(0, 240),
  }));

  const model: ProtocolKnowledgeModel = {
    ...base,
    knowledgeProvider: 'fixture',
    understandingModel: 'fixture-protocol-understanding-v1',
    understandingPromptVersion: UNDERSTANDING_PROMPT_VERSION,
    confidence: Math.min(0.82, base.confidence + 0.2),
    extractionNotes: [
      'Fixture protocol understanding provider (development/smoke). Reconstructs study design from full DOCX text.',
      'Configure VITE_OPENAI_API_KEY and VITE_PROTOCOL_LLM_PROVIDER=openai for live LLM understanding.',
      ...base.extractionNotes,
    ],
    sourceReferences,
    targetPopulation: base.population ?? linesMatching(input, /population|participants|subjects/i)[0],
    inclusionCriteriaSummary:
      linesMatching(input, /inclusion/i)[0] ??
      (text.toLowerCase().includes('inclusion') ? 'Inclusion criteria referenced in source protocol.' : undefined),
    exclusionCriteriaSummary:
      linesMatching(input, /exclusion/i)[0] ??
      (text.toLowerCase().includes('exclusion') ? 'Exclusion criteria referenced in source protocol.' : undefined),
    primaryObjectives: linesMatching(input, /primary\s+objective/i).length
      ? linesMatching(input, /primary\s+objective/i)
      : base.objectives?.slice(0, 2) ?? linesMatching(input, /objective/i).slice(0, 2),
    secondaryObjectives: linesMatching(input, /secondary\s+objective/i),
    exploratoryObjectives: linesMatching(input, /exploratory/i),
    estimands: base.estimands ?? linesMatching(input, /estimand/i),
    arms: base.arms ?? linesMatching(input, /\barm\b|treatment/i),
    armDefinitions: linesMatching(input, /treatment\s+arm|study\s+arm/i),
    interventionModel: linesMatching(input, /parallel|crossover|factorial|single.group/i)[0],
    controlType: linesMatching(input, /placebo|active comparator|control/i)[0],
    interventions: base.interventions ?? linesMatching(input, /intervention|investigational/i),
    visits: linesMatching(input, /visit|screening|baseline|follow-up/i),
    assessments: linesMatching(input, /assessment|procedure|laboratory|vital/i),
    safetyMonitoring: linesMatching(input, /safety|adverse|monitoring|dsmb/i),
    safetyAssessments: base.safetyAssessments,
    efficacyAssessments: base.efficacyAssessments,
    endpoints: base.endpoints ?? linesMatching(input, /endpoint/i),
    objectives: base.objectives,
    population: base.population,
    riskBenefitSummary:
      linesMatching(input, /risk|benefit/i)[0] ??
      'Risk-benefit assessment should be confirmed by clinical reviewers from the full source protocol.',
    statisticalSummary:
      base.statisticalSummary ?? linesMatching(input, /statistic|sample\s+size|analysis/i)[0],
  };

  return model;
}
