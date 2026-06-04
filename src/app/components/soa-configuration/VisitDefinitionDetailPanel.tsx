import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

import type { ScheduleAnchor, VisitDefinition } from '../../domain/protocol/types';
import type { VisitValidationEntry } from './visitValidationIndex';
import {
  formatAnchorSummary,
  formatDisplayLabel,
  formatNominalTiming,
  formatPolicyLabel,
  formatVisitOffsets,
  formatVisitWindow,
} from './visitDisplayFormatters';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

interface VisitDefinitionDetailPanelProps {
  visit: VisitDefinition | null;
  anchor: ScheduleAnchor | undefined;
  validation: VisitValidationEntry | undefined;
  ruleCount: number;
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

export function VisitDefinitionDetailPanel({
  visit,
  anchor,
  validation,
  ruleCount,
}: VisitDefinitionDetailPanelProps) {
  if (!visit) {
    return (
      <Card className="h-full border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Visit detail</CardTitle>
          <CardDescription>Select a visit definition to inspect timing, policies, and anchor linkage.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const displayLabel = formatDisplayLabel(visit);
  const errorCount = validation?.errors.length ?? 0;
  const warningCount = validation?.warnings.length ?? 0;

  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardHeader className="border-b shrink-0 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{displayLabel}</CardTitle>
            <CardDescription className="mt-1 truncate">{visit.name}</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled className="shrink-0 text-xs">
            Edit coming soon
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-2">
          <Badge variant="outline" className="text-[10px]">
            {visit.id}
          </Badge>
          {visit.soaColumnId ? (
            <Badge variant="secondary" className="text-[10px] font-mono">
              {visit.soaColumnId}
            </Badge>
          ) : null}
          {visit.required ? (
            <Badge variant="secondary" className="text-[10px]">
              Required
            </Badge>
          ) : null}
          {errorCount > 0 ? (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <AlertCircle className="h-3 w-3" />
              {errorCount} error{errorCount === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {warningCount > 0 ? (
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/50 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {warningCount} warning{warningCount === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 min-h-0">
        <CardContent className="space-y-4 pt-4">
          {(validation?.errors.length ?? 0) > 0 || (validation?.warnings.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {validation?.errors.map((message) => (
                <Alert key={`${message.code}-${message.path}`} variant="destructive">
                  <AlertCircle />
                  <AlertTitle className="text-xs">{message.code}</AlertTitle>
                  <AlertDescription>{message.message}</AlertDescription>
                </Alert>
              ))}
              {validation?.warnings.map((message) => (
                <Alert key={`${message.code}-${message.path}`}>
                  <AlertTriangle />
                  <AlertTitle className="text-xs">{message.code}</AlertTitle>
                  <AlertDescription>{message.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : null}

          <section>
            <h4 className="text-sm font-medium mb-2">Timing</h4>
            <dl className="grid grid-cols-2 gap-3">
              <DetailField label="Visit type" value={formatPolicyLabel(visit.visitType)} />
              <DetailField label="Epoch" value={visit.epoch ?? '—'} />
              <DetailField label="Order" value={visit.order} />
              <DetailField label="Cycle" value={visit.cycleNumber ?? '—'} />
              <DetailField label="Offsets" value={formatVisitOffsets(visit)} />
              <DetailField label="Nominal" value={formatNominalTiming(visit)} />
              <DetailField label="Window" value={formatVisitWindow(visit)} />
              <DetailField label="Timepoint display" value={visit.timepointDisplay ?? '—'} />
            </dl>
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-medium mb-2">Policies</h4>
            <dl className="grid grid-cols-1 gap-3">
              <DetailField label="Missed visit" value={formatPolicyLabel(visit.missedVisitPolicy)} />
              <DetailField label="Re-anchor" value={formatPolicyLabel(visit.reanchorPolicy)} />
              <DetailField label="Ripple" value={formatPolicyLabel(visit.ripplePolicy)} />
              <DetailField
                label="Preserve original schedule"
                value={visit.preserveOriginalSchedule === true ? 'Yes' : visit.preserveOriginalSchedule === false ? 'No' : '—'}
              />
              <DetailField label="Make-up window (days)" value={visit.allowedMakeupWindowDays ?? '—'} />
            </dl>
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-medium mb-2">Schedule anchor</h4>
            {anchor ? (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{anchor.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {anchor.id}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">{formatAnchorSummary(anchor)}</p>
                {anchor.description ? <p>{anchor.description}</p> : null}
                {anchor.sourceVisitId ? (
                  <p className="text-xs text-muted-foreground">
                    Source visit: <span className="font-mono">{anchor.sourceVisitId}</span>
                  </p>
                ) : null}
                {anchor.sourceEventType ? (
                  <p className="text-xs text-muted-foreground">
                    Source event: {anchor.sourceEventType}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Anchor <span className="font-mono">{visit.anchorId}</span> not found in catalog.
              </p>
            )}
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-medium mb-2">References</h4>
            <dl className="grid grid-cols-1 gap-3">
              <DetailField label="Clinical design visit" value={visit.clinicalDesignVisitId ?? '—'} />
              <DetailField label="SoA column id" value={visit.soaColumnId ?? '—'} />
              <DetailField
                label="Cache column id"
                value={
                  typeof visit.metadata?.scheduleVisitId === 'string'
                    ? visit.metadata.scheduleVisitId
                    : visit.soaColumnId ?? '—'
                }
              />
              <DetailField label="Linked schedule rules" value={ruleCount} />
              {visit.description ? <DetailField label="Description" value={visit.description} /> : null}
            </dl>
          </section>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
