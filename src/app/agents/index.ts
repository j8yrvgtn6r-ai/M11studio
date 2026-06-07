export type { Agent } from './Agent';

export type { AgentContext, AgentTrigger } from './AgentContext';

export type { AgentResult, AgentResultStatus } from './AgentResult';

export type { AgentEvent, AgentEventType } from './agentEvents';

export { createAgentEvent } from './agentEvents';

export { createAgentResult } from './AgentResult';

export { AgentManager, agentManager, applyAgentStudyModelUpdates } from './AgentManager';

export { CONSISTENCY_AGENT_ID, consistencyAgent } from './ConsistencyAgent';

export type {

  ConsistencyAgentInput,

  ConsistencyAgentOutput,

  ConsistencyAgentTrigger,

} from './ConsistencyAgent';

export {

  evaluateConsistencyImpacts,

  expandM11SectionTargets,

  getM11ConsistencyDependencyMetadata,

  M11_CONSISTENCY_DEPENDENCY_RULES,

} from './consistencyRules';

export type { ConsistencyImpactReason, ConsistencySectionImpact } from './consistencyRules';

export {

  ensureAgentsRegistered,

  runConsistencyAgentCheck,

  scheduleConsistencyAgentCheck,

} from './consistencyAgentRunner';

export { KNOWLEDGE_AGENT_ID, knowledgeAgent } from './KnowledgeAgent';

export type {

  KnowledgeAgentInput,

  KnowledgeAgentOutput,

  KnowledgeAgentTextSource,

  KnowledgeExtractedItem,

} from './knowledgeAgentHeuristics';

export { extractKnowledgeFromSectionText } from './knowledgeAgentHeuristics';

export {

  resolveKnowledgeSourceFromDraft,

  runKnowledgeAgentForSection,

  scheduleKnowledgeAgentForSectionEdit,

  subscribeStudyModelUpdated,

  triggerKnowledgeAgentFromDraft,

} from './knowledgeAgentRunner';

export {
  STRUCTURAL_MAPPING_AGENT_ID,
  structuralMappingAgent,
} from './StructuralMappingAgent';
export type {
  AgentMappedSection,
  StructuralMappingAgentInput,
  StructuralMappingAgentOutput,
  StructuralMappingAgentTrigger,
  SuspiciousMappingRecord,
} from './StructuralMappingAgent';
export {
  evaluateStructuralMapping,
  formatMappingMethodLabel,
  TITLE_SYNONYM_TARGETS,
  toStructuralMappingResult,
} from './structuralMappingRules';
export type { StructuralMappingRuleOptions } from './structuralMappingRules';
export {
  ensureStructuralMappingAgentsRegistered,
  runStructuralMappingAgent,
} from './structuralMappingAgentRunner';

export { VALIDATION_AGENT_ID, validationAgent } from './ValidationAgent';
export type {
  StructuralSuggestion,
  TerminologySuggestion,
  ValidationAgentInput,
  ValidationAgentOutput,
  ValidationAgentTrigger,
} from './ValidationAgent';
export {
  buildTrackChangeSegments,
  enrichTrackChangeSegments,
  buildSideBySidePanels,
  summarizeValidationChanges,
  formatValidationChangeTooltip,
  formatValidationChangeType,
  buildValidationReviewCompactSummary,
  resolveControlledTerminologyStatus,
  resolveControlledTerminologyMessage,
  resolveM11StructureStatus,
  formatValidationProviderLabel,
  isLegacyTerminologyPendingMessage,
  evaluateValidation,
  evaluateValidationFromDraft,
  getControlledTerminologySuggestions,
} from './validationRules';
export type {
  ValidationAttemptRecord,
  ValidationChange,
  ValidationChangeSeverity,
  ValidationChangeType,
} from './validationRules';
export {
  emitValidationAccepted,
  emitValidationRejected,
  ensureValidationAgentRegistered,
  runValidationAgentForSection,
  runLlmValidationAgentForSection,
} from './validationAgentRunner';

export { GENERATION_AGENT_ID, generationAgent } from './GenerationAgent';
export type {
  EstimatedComplexity,
  GenerationAgentInput,
  GenerationAgentOutput,
  GenerationAgentTrigger,
  GenerationQueueItem,
  GenerationQueuePriority,
  GenerationQueueSource,
  SkippedSectionRecord,
} from './GenerationAgent';
export {
  estimateSectionComplexity,
  evaluateGenerationSchedule,
  getPrioritySectionIdsForScheduling,
  resolveQueueTypeLabel,
} from './generationSchedulingRules';
export {
  ensureGenerationAgentRegistered,
  runGenerationAgentSchedule,
  scheduleGenerationSync,
} from './generationAgentRunner';

export { SOA_AGENT_ID, soaAgent } from './SoAAgent';
export type { SoAAgentInput, SoAAgentOutput, SoAAgentTrigger, SoAExtractedItem } from './SoAAgent';
export { evaluateSoAScheduleExtraction, countSoAKnowledgePatch } from './soaAgentRules';
export {
  acceptCurrentSoAProposal,
  ensureSoAAgentRegistered,
  generateFirstPassSoA,
  getCurrentSoAProposal,
  rejectCurrentSoAProposal,
  runSoAAgent,
  runSoAAgentFromImport,
} from './soaAgentRunner';

