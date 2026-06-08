import { AlertTriangle, Download } from 'lucide-react';

import type { UsdmExportResult } from '../../domain/usdm';
import { getUsdmReadinessLabel } from '../../domain/usdm';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface UsdmExportReadinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportResult: UsdmExportResult | null;
  onDownload: () => void;
}

function readinessBadgeVariant(state: UsdmExportResult['readiness']['state']) {
  if (state === 'ready') return 'secondary' as const;
  if (state === 'readyWithWarnings') return 'outline' as const;
  return 'destructive' as const;
}

export function UsdmExportReadinessDialog({
  open,
  onOpenChange,
  exportResult,
  onDownload,
}: UsdmExportReadinessDialogProps) {
  if (!exportResult) return null;

  const { readiness, validation } = exportResult;
  const canDownloadAnyway = validation.summary.errorCount === 0;
  const canDownload = canDownloadAnyway;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="usdm-export-readiness-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Schedule Export Readiness
            <Badge variant={readinessBadgeVariant(readiness.state)} className="text-[10px]">
              {getUsdmReadinessLabel(readiness.state)}
            </Badge>
          </DialogTitle>
          <DialogDescription>{readiness.message}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                ['Arms', readiness.counts.arms],
                ['Epochs', readiness.counts.epochs],
                ['Elements', readiness.counts.elements],
                ['Visits', readiness.counts.encounters],
                ['Activities', readiness.counts.activities],
                ['Instances', readiness.counts.scheduleInstances],
                ['Timings', readiness.counts.timings],
                ['Timelines', readiness.counts.scheduleTimelines],
              ] as const
            ).map(([label, count]) => (
              <div key={label} className="rounded border border-border/60 px-2 py-1.5 text-center">
                <div className="font-medium">{count}</div>
                <div className="text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {readiness.missingFields.length > 0 ? (
            <div>
              <p className="font-medium mb-1">Missing fields</p>
              <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                {readiness.missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {validation.errors.length > 0 ? (
            <div>
              <p className="font-medium mb-1 text-destructive">Blocking errors</p>
              <ul className="space-y-1">
                {validation.errors.map((error) => (
                  <li key={`${error.code}-${error.message}`} className="text-destructive">
                    {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {validation.warnings.length > 0 ? (
            <div>
              <p className="font-medium mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Warnings
              </p>
              <ul className="space-y-1 text-muted-foreground max-h-32 overflow-y-auto">
                {validation.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canDownload ? (
            <Button size="sm" onClick={onDownload} data-testid="usdm-export-download-button">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {readiness.state === 'readyWithWarnings' ? 'Download anyway' : 'Download JSON'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
