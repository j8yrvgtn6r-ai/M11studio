export type ProtocolLintSeverity = 'info' | 'warning' | 'error';

export type ProtocolLintCategory =
  | 'terminology'
  | 'structure'
  | 'requiredContent'
  | 'consistency'
  | 'soa'
  | 'grammar'
  | 'style';

export type ProtocolLintSource =
  | 'terminology'
  | 'm11Template'
  | 'knowledgeGraph'
  | 'studyModel'
  | 'soaKnowledge'
  | 'validationAgent'
  | 'localRule';

export type ProtocolQuickFixActionType =
  | 'replaceText'
  | 'openIntellisense'
  | 'openValidation'
  | 'navigateSection'
  | 'runSoAAgent'
  | 'none';

export type ProtocolLintSchedulerState = 'idle' | 'scheduled' | 'running' | 'complete' | 'failed';

export interface ProtocolLintIssue {
  id: string;
  sectionId: string;
  lineNumber?: number;
  startOffset?: number;
  endOffset?: number;
  severity: ProtocolLintSeverity;
  category: ProtocolLintCategory;
  message: string;
  suggestedFix?: string;
  source: ProtocolLintSource;
  relatedEntityIds?: string[];
  relatedSectionIds?: string[];
  createdAt: string;
}

export interface ProtocolQuickFix {
  id: string;
  label: string;
  issueId: string;
  replacementText?: string;
  range?: { startOffset: number; endOffset: number };
  actionType: ProtocolQuickFixActionType;
  metadata?: Record<string, string>;
}

export interface ProtocolLintContext {
  sectionId: string;
  sectionTitle?: string;
  content: string;
  plainText: string;
}

export interface ProtocolLintSummary {
  sectionId: string;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  lastLintedAt: string | null;
  schedulerState: ProtocolLintSchedulerState;
}

export interface ProtocolLintRunResult {
  issues: ProtocolLintIssue[];
  quickFixes: ProtocolQuickFix[];
  durationMs: number;
  truncated: boolean;
}
