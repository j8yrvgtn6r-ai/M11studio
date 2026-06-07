import type { SoAMatrixProposalPreview } from '../../domain/soa-knowledge/soaTableExtractionTypes';
import { Badge } from '../ui/badge';

interface SoAMatrixProposalPreviewProps {
  preview?: SoAMatrixProposalPreview | null;
}

export function SoAMatrixProposalPreviewPanel({ preview }: SoAMatrixProposalPreviewProps) {
  if (!preview || (preview.rows.length === 0 && preview.columns.length === 0)) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="soa-matrix-proposal-preview-empty">
        No matrix proposal preview available. Import a protocol with a Schedule of Activities table or run SoA Agent after narrative extraction.
      </div>
    );
  }

  const cellMap = new Map(preview.cells.map((cell) => [`${cell.rowId}:${cell.columnId}`, cell]));

  return (
    <div className="space-y-3" data-testid="soa-matrix-proposal-preview">
      <p className="text-xs text-muted-foreground">
        Preview-only matrix suggestion. Accept the SoA proposal to apply knowledge patches; configuration updates remain proposal-gated.
      </p>
      <div className="overflow-auto rounded-md border border-border">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-2 py-1 text-left font-medium sticky left-0 bg-muted/40">Assessment / Visit</th>
              {preview.columns.map((column) => (
                <th key={column.id} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="px-2 py-1 font-medium sticky left-0 bg-background whitespace-nowrap">{row.label}</td>
                {preview.columns.map((column) => {
                  const cell = cellMap.get(`${row.id}:${column.id}`);
                  return (
                    <td key={`${row.id}-${column.id}`} className="px-2 py-1 text-center">
                      {cell ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="font-semibold">{cell.marker}</span>
                          {cell.conditionLabel ? (
                            <span className="text-[10px] text-muted-foreground">conditional</span>
                          ) : null}
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            table
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
