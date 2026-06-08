import { AlertCircle, AlertTriangle, CheckCircle2, GitBranch } from 'lucide-react';
import type {
  LineDiagnostic,
  SectionDependencyReference,
  SectionValidationSummary,
} from '../../domain/protocol/authoring/editorIntegration';
import type { IntellisenseAcceptanceRecord } from '../../domain/protocol/authoring/intellisense';
import type { EntityInsertionRecord } from '../../domain/protocol/entities';
import type { ProtocolLintIssue, ProtocolQuickFix } from '../../domain/protocol/authoring/linting';
import { applyProtocolQuickFix } from '../../domain/protocol/authoring/linting';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface SectionIdeValidationPanelProps {
  summary: SectionValidationSummary;
  dependencyReferences: SectionDependencyReference[];
  lineDiagnostics?: LineDiagnostic[];
  lintIssues?: ProtocolLintIssue[];
  lintQuickFixes?: ProtocolQuickFix[];
  lastLintedAt?: string | null;
  intellisenseAcceptanceLog?: IntellisenseAcceptanceRecord[];
  entityInsertionLog?: EntityInsertionRecord[];
  onNavigateDiagnostic?: (diagnostic: LineDiagnostic) => void;
}

export function SectionIdeValidationPanel({
  summary,
  dependencyReferences,
  lineDiagnostics = [],
  lintIssues = [],
  lintQuickFixes = [],
  lastLintedAt = null,
  intellisenseAcceptanceLog = [],
  entityInsertionLog = [],
  onNavigateDiagnostic,
}: SectionIdeValidationPanelProps) {
  const referencedBy = dependencyReferences.filter((entry) => entry.referencedBySectionTitle);
  const terminologyDiagnostics = lineDiagnostics.filter((entry) => entry.category === 'terminology');
  const entityDiagnostics = lineDiagnostics.filter((entry) => entry.category === 'entity');
  const acceptedTerms = lineDiagnostics.filter((entry) => entry.source === 'terminologySuggestionAccepted');

  return (
    <div className="space-y-4" data-testid="section-ide-validation-panel">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          data-testid="open-review-workspace-from-validation"
          onClick={() => window.dispatchEvent(new CustomEvent('m11:open-review-workspace'))}
        >
          Open Review Workspace
        </Button>
      </div>
      {summary.passes ? (
        <div className="flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/5 p-3" data-testid="section-passes-validation">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Section passes validation</p>
            <p className="text-xs text-muted-foreground">Structure and terminology checks show no open issues.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs" data-testid="validation-tab-status-grid">
          <StatusTile label="Structure" value={summary.structureStatus} count={summary.structureIssueCount} />
          <StatusTile label="Terminology" value={summary.terminologyStatus} count={summary.terminologyIssueCount} />
          <StatusTile label="Required content" value={summary.missingRequiredCount > 0 ? 'Missing' : 'OK'} count={summary.missingRequiredCount} />
          <StatusTile label="Consistency" value={summary.consistencyIssueCount > 0 ? 'Issues' : 'OK'} count={summary.consistencyIssueCount} />
        </div>
      )}

      <div className="space-y-2" data-testid="live-lint-panel">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">Live linting</p>
          {lastLintedAt ? (
            <span className="text-[10px] text-muted-foreground">Last linted {new Date(lastLintedAt).toLocaleTimeString()}</span>
          ) : null}
        </div>
        {lintIssues.length === 0 ? (
          <p className="text-xs text-green-700 dark:text-green-300" data-testid="live-lint-empty">
            Live linting found no issues.
          </p>
        ) : (
          <div className="space-y-2">
            {(['terminology', 'structure', 'consistency', 'soa', 'style', 'grammar', 'requiredContent'] as const).map((category) => {
              const grouped = lintIssues.filter((issue) => issue.category === category);
              if (grouped.length === 0) {
                return null;
              }
              return (
                <div key={category} className="space-y-1" data-testid={`live-lint-group-${category}`}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{category}</p>
                  {grouped.slice(0, 4).map((issue) => {
                    const fixes = lintQuickFixes.filter((fix) => fix.issueId === issue.id);
                    return (
                      <div key={issue.id} className="rounded-md border border-border p-2 text-xs">
                        <div className="flex items-center gap-1.5 mb-1">
                          {issue.severity === 'error' ? (
                            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <Badge variant="outline" className="h-4 text-[10px]">{issue.category}</Badge>
                          {issue.lineNumber ? <span className="text-muted-foreground">L{issue.lineNumber}</span> : null}
                        </div>
                        <p>{issue.message}</p>
                        {fixes.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {fixes.slice(0, 2).map((fix) => (
                              <Button
                                key={fix.id}
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px]"
                                data-testid={`quick-fix-${fix.id}`}
                                onClick={() => applyProtocolQuickFix(fix)}
                              >
                                {fix.label}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lineDiagnostics.length > 0 ? (
        <div className="space-y-2" data-testid="line-diagnostics-list">
          <p className="text-xs font-semibold text-muted-foreground">Line diagnostics</p>
          {lineDiagnostics.slice(0, 16).map((diagnostic) => (
            <button
              key={diagnostic.id}
              type="button"
              className="w-full rounded-md border border-border p-2 text-left text-xs hover:bg-muted/40"
              onClick={() => onNavigateDiagnostic?.(diagnostic)}
              data-testid={`line-diagnostic-${diagnostic.id}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {diagnostic.severity === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <Badge variant="outline" className="h-4 text-[10px]">{diagnostic.category}</Badge>
                <span className="text-muted-foreground">L{diagnostic.lineNumber}</span>
              </div>
              <p>{diagnostic.message}</p>
              {diagnostic.suggestedFix ? (
                <p className="text-muted-foreground mt-1">Suggested: {diagnostic.suggestedFix}</p>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {terminologyDiagnostics.length > 0 ? (
        <div className="space-y-1" data-testid="terminology-diagnostics-list">
          <p className="text-xs font-semibold text-muted-foreground">Terminology diagnostics</p>
          {terminologyDiagnostics.slice(0, 6).map((diagnostic) => (
            <p key={diagnostic.id} className="text-xs text-muted-foreground">L{diagnostic.lineNumber}: {diagnostic.message}</p>
          ))}
        </div>
      ) : null}

      {acceptedTerms.length > 0 ? (
        <div className="space-y-1" data-testid="accepted-terminology-list">
          <p className="text-xs font-semibold text-muted-foreground">Accepted terminology</p>
          {acceptedTerms.slice(0, 6).map((diagnostic) => (
            <p key={diagnostic.id} className="text-xs text-green-700 dark:text-green-300">{diagnostic.message}</p>
          ))}
        </div>
      ) : null}

      {intellisenseAcceptanceLog.length > 0 ? (
        <div className="space-y-1" data-testid="intellisense-acceptance-list">
          <p className="text-xs font-semibold text-muted-foreground">IntelliSense acceptances</p>
          {intellisenseAcceptanceLog.slice(-6).reverse().map((entry) => (
            <p key={entry.id} className="text-xs text-green-700 dark:text-green-300">
              {entry.originalText} → {entry.insertedText}
              <span className="text-muted-foreground"> · {entry.kind}</span>
            </p>
          ))}
        </div>
      ) : null}

      {entityDiagnostics.length > 0 ? (
        <div className="space-y-1" data-testid="entity-diagnostics-list">
          <p className="text-xs font-semibold text-muted-foreground">Entity diagnostics</p>
          {entityDiagnostics.slice(0, 6).map((diagnostic) => (
            <p key={diagnostic.id} className="text-xs text-amber-700 dark:text-amber-300">
              L{diagnostic.lineNumber}: {diagnostic.message}
            </p>
          ))}
        </div>
      ) : null}

      {entityInsertionLog.length > 0 ? (
        <div className="space-y-1" data-testid="entity-insertion-list">
          <p className="text-xs font-semibold text-muted-foreground">Entity insertions</p>
          {entityInsertionLog.slice(-6).reverse().map((entry) => (
            <p key={entry.id} className="text-xs text-green-700 dark:text-green-300">
              {entry.insertedText}
              <span className="text-muted-foreground"> · {entry.entityType}</span>
            </p>
          ))}
        </div>
      ) : null}

      {summary.findings.length > 0 ? (
        <div className="space-y-2">
          {summary.findings.slice(0, 12).map((finding, index) => (
            <div key={`${finding.code ?? 'finding'}-${index}`} className="rounded-md border border-border p-2 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                {finding.severity === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <Badge variant="outline" className="h-4 text-[10px]">{finding.severity}</Badge>
              </div>
              <p>{finding.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2" data-testid="section-dependency-references">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="h-4 w-4" />
          Referenced by
        </div>
        {referencedBy.length === 0 ? (
          <p className="text-xs text-muted-foreground">No dependency graph references for this section yet.</p>
        ) : (
          referencedBy.slice(0, 8).map((entry, index) => (
            <div key={`${entry.nodeId}-${index}`} className="text-xs rounded-md border border-border px-2 py-1.5">
              <span className="font-medium">{entry.referencedBySectionTitle}</span>
              {entry.relationshipLabel ? (
                <span className="text-muted-foreground"> · {entry.relationshipLabel}</span>
              ) : null}
              <span className="text-muted-foreground"> · {entry.nodeName}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusTile({ label, value, count }: { label: string; value: string; count: number }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}{count > 0 ? ` (${count})` : ''}</p>
    </div>
  );
}
