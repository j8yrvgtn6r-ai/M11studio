import type { IchM11SectionSpec } from '../../ichM11/types';
import type { ProtocolKnowledgeModel } from '../protocolKnowledgeTypes';
import type { GeneratedSectionDraft, ImportedProtocolSource, ProtocolSourceArtifact } from '../types';
import type { M11GenerationCallbacks } from './m11GenerationProgress';

export type LlmProviderId = 'openai' | 'azure-openai' | 'anthropic' | 'local' | 'fixture';

export const GENERATION_PROMPT_VERSION = 'm11-reconstruct-v1';
export const UNDERSTANDING_PROMPT_VERSION = 'protocol-understand-v1';

export interface LlmProviderConfig {
  providerId: LlmProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
  organization?: string;
  project?: string;
}

export interface ProtocolUnderstandingInput {
  sourceExtraction: ImportedProtocolSource;
  m11TemplateSections: IchM11SectionSpec[];
  m11TechnicalSpecification: IchM11SectionSpec[];
  artifact: ProtocolSourceArtifact;
}

export interface M11GenerationInput {
  sourceExtraction: ImportedProtocolSource;
  protocolKnowledgeModel: ProtocolKnowledgeModel;
  m11TemplateSections: IchM11SectionSpec[];
  m11TechnicalSpecification: IchM11SectionSpec[];
  controlledTerminology: { codelistCount: number; termCount: number };
  artifact: ProtocolSourceArtifact;
  sectionIds?: string[];
}

export interface ProtocolUnderstandingCallbacks {
  signal?: AbortSignal;
}

export interface ProtocolUnderstandingProvider {
  readonly id: LlmProviderId;
  readonly displayName: string;
  understand(
    input: ProtocolUnderstandingInput,
    callbacks?: ProtocolUnderstandingCallbacks,
  ): Promise<ProtocolKnowledgeModel>;
}

export interface M11GenerationProvider {
  readonly id: LlmProviderId;
  readonly displayName: string;
  generateSections(
    input: M11GenerationInput,
    callbacks?: M11GenerationCallbacks,
  ): Promise<GeneratedSectionDraft[]>;
  regenerateSection(
    input: M11GenerationInput,
    sectionId: string,
    priorDraft?: GeneratedSectionDraft,
    callbacks?: M11GenerationCallbacks,
  ): Promise<GeneratedSectionDraft>;
}

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
