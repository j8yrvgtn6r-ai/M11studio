import { AlertCircle, AlertTriangle, CheckCircle2, GitBranch } from 'lucide-react';
import type {
  LineDiagnostic,
  SectionDependencyReference,
  SectionValidationSummary,
} from '../../domain/protocol/authoring/editorIntegration';
import { Badge } from '../ui/badge';

interface SectionIdeValidationPanelProps {
  summary: SectionValidationSummary;
  dependencyReferences: SectionDependencyReference[];
  lineDiagnostics?: LineDiagnostic[];
  onNavigateDiagnostic?: (diagnostic: LineDiagnostic) => void;
}

export function SectionIdeValidationPanel({
  summary,
  dependencyReferences,
  lineDiagnostics = [],
  onNavigateDiagnostic,
}: SectionIdeValidationPanelProps) {
  const referencedBy = dependencyReferences.filter((entry) => entry.referencedBySectionTitle);
  const terminologyDiagnostics = lineDiagnostics.filter((entry) => entry.category === 'terminology');
  const acceptedTerms = lineDiagnostics.filter((entry) => entry.source === 'terminologySuggestionAccepted');

  return (
    <div className="space-y-4" data-testid="section-ide-validation-panel">
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
