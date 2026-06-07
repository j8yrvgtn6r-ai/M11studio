import { AlertCircle, AlertTriangle, CheckCircle2, GitBranch } from 'lucide-react';
import type {
  SectionDependencyReference,
  SectionValidationSummary,
} from '../../domain/protocol/authoring/editorIntegration';
import { Badge } from '../ui/badge';

interface SectionIdeValidationPanelProps {
  summary: SectionValidationSummary;
  dependencyReferences: SectionDependencyReference[];
}

export function SectionIdeValidationPanel({
  summary,
  dependencyReferences,
}: SectionIdeValidationPanelProps) {
  const referencedBy = dependencyReferences.filter((entry) => entry.referencedBySectionTitle);

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
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
      {count > 0 ? <p className="text-amber-600">{count} issue(s)</p> : null}
    </div>
  );
}
