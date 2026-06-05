import { useProtocolImport } from '../../domain/protocol/import/ProtocolImportContext';
import { compareProtocolCommits } from '../../domain/protocol/import/protocolVersioning';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';

export function VersionHistoryPanel() {
  const { versioning } = useProtocolImport();
  const { currentVersion, commits } = versioning;

  return (
    <div className="flex flex-col h-full" data-testid="version-history-panel">
      <div className="px-4 py-3 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-sm">Version History</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Local commit scaffold — future cloud-hosted versioning will sync here.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled data-testid="compare-versions-button">
          Compare Versions (coming soon)
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-border bg-muted/10 shrink-0 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Current version</p>
          <p className="font-medium" data-testid="current-version-label">
            {currentVersion.label}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Head commit</p>
          <p className="font-mono text-xs truncate" data-testid="head-commit-id">
            {currentVersion.headCommitId}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <ol className="p-4 space-y-3 max-w-3xl">
          {commits.map((commit, index) => (
            <li
              key={commit.id}
              className="rounded-lg border border-border bg-card p-3 text-sm"
              data-testid={`protocol-commit-${commit.id}`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium">{commit.message}</span>
                {index === 0 ? <Badge>HEAD</Badge> : null}
                <Badge variant="outline">{commit.source}</Badge>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">{commit.id}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(commit.createdAt).toLocaleString()} · {commit.createdBy}
              </p>
              {(commit.changedSectionIds ?? []).length > 0 ? (
                <p className="text-xs mt-1">
                  Sections: {commit.changedSectionIds.join(', ')}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground mt-1">{commit.validationSummary}</p>
              {index < commits.length - 1 ? (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Diff scaffold:{' '}
                  {compareProtocolCommits(commit.protocolId, commit.id, commits[index + 1].id).note}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </ScrollArea>
    </div>
  );
}
