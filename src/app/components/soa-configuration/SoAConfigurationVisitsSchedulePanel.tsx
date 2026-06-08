import { useEffect, useMemo, useState } from 'react';

import { AlertCircle, AlertTriangle, Plus } from 'lucide-react';

import {
  getAssessmentScheduleRulesForVisit,
  getProtocolDocument,
  getScheduleAnchors,
  getVisitDefinitions,
  subscribe,
} from '../../domain/protocol';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { VisitDefinitionDetailPanel } from './VisitDefinitionDetailPanel';
import {
  formatAnchorSummary,
  formatDisplayLabel,
  formatNominalTiming,
  formatPolicyLabel,
  formatVisitOffsets,
  formatVisitWindow,
  resolveAnchorLabel,
} from './visitDisplayFormatters';
import { buildVisitValidationIndex } from './visitValidationIndex';
import { SoAEntityEditorDialog } from './SoAEntityEditorDialog';
import { useSoAReadiness } from './useSoAReadiness';
import { Button } from '../ui/button';

/** Read-only visit schedule catalog (anchors + visit definitions). */
export function SoAConfigurationVisitsSchedulePanel() {
  const [protocolRevision, setProtocolRevision] = useState(0);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const { firstPass } = useSoAReadiness();

  useEffect(() => {
    return subscribe(() => {
      setProtocolRevision((revision) => revision + 1);
    });
  }, []);

  const document = useMemo(() => getProtocolDocument(), [protocolRevision]);
  const visitDefinitions = useMemo(
    () => [...getVisitDefinitions(document)].sort((left, right) => left.order - right.order),
    [document],
  );
  const anchors = useMemo(() => getScheduleAnchors(document), [document]);
  const anchorById = useMemo(() => new Map(anchors.map((anchor) => [anchor.id, anchor])), [anchors]);
  const validationIndex = useMemo(() => buildVisitValidationIndex(document), [document]);

  useEffect(() => {
    if (visitDefinitions.length === 0) {
      setSelectedVisitId(null);
      return;
    }
    if (!selectedVisitId || !visitDefinitions.some((visit) => visit.id === selectedVisitId)) {
      setSelectedVisitId(visitDefinitions[0].id);
    }
  }, [visitDefinitions, selectedVisitId]);

  const selectedVisit = visitDefinitions.find((visit) => visit.id === selectedVisitId) ?? null;
  const selectedAnchor = selectedVisit ? anchorById.get(selectedVisit.anchorId) : undefined;
  const selectedValidation = selectedVisit ? validationIndex.get(selectedVisit.id) : undefined;
  const selectedRuleCount = selectedVisit
    ? getAssessmentScheduleRulesForVisit(selectedVisit.id, document).length
    : 0;

  return (
    <div className="space-y-4 min-h-[360px]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule anchors</CardTitle>
          <CardDescription>
            Read-only catalog from <span className="font-mono">visitSchedule.anchors</span> ({anchors.length})
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[160px]">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Name</TableHead>
                    <TableHead className="min-w-[120px]">Type</TableHead>
                    <TableHead className="min-w-[140px] font-mono text-xs">Id</TableHead>
                    <TableHead className="min-w-[140px]">Source visit</TableHead>
                    <TableHead className="min-w-[200px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anchors.map((anchor) => (
                    <TableRow key={anchor.id}>
                      <TableCell className="font-medium">{anchor.name}</TableCell>
                      <TableCell className="text-xs">{formatAnchorSummary(anchor)}</TableCell>
                      <TableCell className="font-mono text-xs">{anchor.id}</TableCell>
                      <TableCell className="font-mono text-xs">{anchor.sourceVisitId ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{anchor.description ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[320px]">
        <Card className="flex-[3] min-w-0 flex flex-col min-h-[320px]">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Visit definitions</CardTitle>
                <CardDescription>
                  Visit catalog from <span className="font-mono">visitSchedule.visitDefinitions</span> ({visitDefinitions.length})
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setEditorOpen(true)} data-testid="soa-add-visit-button">
                <Plus className="h-4 w-4" />
                Add Visit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            {visitDefinitions.length === 0 ? (
              <div
                className="mx-4 mb-4 rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground"
                data-testid="soa-empty-state-visit-config"
              >
                <p>No visits have been created yet. Add a visit manually or generate a first-pass SoA after protocol knowledge is available.</p>
                {!firstPass.ready ? (
                  <p className="mt-3 text-xs">Add protocol content or import a protocol before generating a first-pass SoA.</p>
                ) : null}
              </div>
            ) : (
            <ScrollArea className="h-full max-h-[360px]">
              <div className="min-w-max">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Display / name</TableHead>
                      <TableHead className="min-w-[90px]">Type</TableHead>
                      <TableHead className="min-w-[90px]">Epoch</TableHead>
                      <TableHead className="min-w-[120px]">Anchor</TableHead>
                      <TableHead className="min-w-[100px]">Offsets</TableHead>
                      <TableHead className="min-w-[110px]">Nominal</TableHead>
                      <TableHead className="min-w-[100px]">Window</TableHead>
                      <TableHead className="min-w-[110px]">Missed</TableHead>
                      <TableHead className="min-w-[110px]">Re-anchor</TableHead>
                      <TableHead className="min-w-[110px]">Ripple</TableHead>
                      <TableHead className="min-w-[70px] font-mono text-xs">SoA col</TableHead>
                      <TableHead className="min-w-[80px] text-right">Validation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitDefinitions.map((visit) => {
                      const validation = validationIndex.get(visit.id);
                      const errorCount = validation?.errors.length ?? 0;
                      const warningCount = validation?.warnings.length ?? 0;
                      const isSelected = visit.id === selectedVisitId;

                      return (
                        <TableRow
                          key={visit.id}
                          data-state={isSelected ? 'selected' : undefined}
                          className="cursor-pointer data-[state=selected]:bg-accent/40"
                          onClick={() => setSelectedVisitId(visit.id)}
                        >
                          <TableCell>
                            <div className="font-medium text-sm">{formatDisplayLabel(visit)}</div>
                            {visit.displayLabel && visit.displayLabel !== visit.name ? (
                              <div className="text-xs text-muted-foreground">{visit.name}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs">{visit.visitType}</TableCell>
                          <TableCell className="text-xs">{visit.epoch ?? '—'}</TableCell>
                          <TableCell className="text-xs">
                            {resolveAnchorLabel(anchorById.get(visit.anchorId), visit.anchorId)}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{formatVisitOffsets(visit)}</TableCell>
                          <TableCell className="text-xs">{formatNominalTiming(visit)}</TableCell>
                          <TableCell className="text-xs font-mono">{formatVisitWindow(visit)}</TableCell>
                          <TableCell className="text-xs">{formatPolicyLabel(visit.missedVisitPolicy)}</TableCell>
                          <TableCell className="text-xs">{formatPolicyLabel(visit.reanchorPolicy)}</TableCell>
                          <TableCell className="text-xs">{formatPolicyLabel(visit.ripplePolicy)}</TableCell>
                          <TableCell className="font-mono text-xs">{visit.soaColumnId ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {errorCount > 0 ? (
                                <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5">
                                  <AlertCircle className="h-3 w-3" />
                                  {errorCount}
                                </Badge>
                              ) : null}
                              {warningCount > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] gap-0.5 px-1.5 border-amber-500/50 text-amber-700 dark:text-amber-400"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {warningCount}
                                </Badge>
                              ) : null}
                              {errorCount === 0 && warningCount === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="flex-[2] min-w-[280px] min-h-[320px]">
          <VisitDefinitionDetailPanel
            visit={selectedVisit}
            anchor={selectedAnchor}
            validation={selectedValidation}
            ruleCount={selectedRuleCount}
          />
        </div>
      </div>

      <SoAEntityEditorDialog
        open={editorOpen}
        mode="create"
        entityKind="visit"
        onOpenChange={setEditorOpen}
        onSuccess={() => setProtocolRevision((value) => value + 1)}
      />
    </div>
  );
}
