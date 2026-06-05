/**
 * M11 section generation boundary — delegates to configured M11GenerationProvider (LLM or fixture).
 */

import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';
import { ICH_M11_TECHNICAL_SPEC_SECTION_SPECS } from '../ichM11/ichM11TechnicalSpecification';
import type { IchM11SectionSpec } from '../ichM11/types';
import type { ProtocolKnowledgeModel } from './protocolKnowledgeTypes';
import { runM11SectionGeneration } from './llm/m11GenerationProvider';
import type {
  GeneratedSectionDraft,
  ImportedProtocolSource,
  ProtocolSourceArtifact,
  SectionGenerationProvider,
} from './types';

export interface RewriteProtocolSectionsInput {
  sourceExtraction: ImportedProtocolSource;
  protocolKnowledgeModel: ProtocolKnowledgeModel;
  m11TemplateSections?: IchM11SectionSpec[];
  m11TechnicalSpecification?: IchM11SectionSpec[];
  controlledTerminology?: { codelistCount: number; termCount: number };
  artifact: ProtocolSourceArtifact;
  generationProvider?: SectionGenerationProvider;
  sectionIds?: string[];
}

/** Generates M11 section draft proposals via LLM reconstruction (never auto-approved). */
export async function rewriteProtocolToM11Sections(
  input: RewriteProtocolSectionsInput,
): Promise<GeneratedSectionDraft[]> {
  return runM11SectionGeneration({
    sourceExtraction: input.sourceExtraction,
    protocolKnowledgeModel: input.protocolKnowledgeModel,
    m11TemplateSections: input.m11TemplateSections ?? ICH_M11_TEMPLATE_SECTION_SPECS,
    m11TechnicalSpecification: input.m11TechnicalSpecification ?? ICH_M11_TECHNICAL_SPEC_SECTION_SPECS,
    controlledTerminology: input.controlledTerminology ?? { codelistCount: 0, termCount: 0 },
    artifact: input.artifact,
    sectionIds: input.sectionIds,
  });
}
