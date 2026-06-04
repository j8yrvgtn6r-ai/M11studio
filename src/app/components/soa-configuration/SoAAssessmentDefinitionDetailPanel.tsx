import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

import type { AssessmentScheduleRule, SoAAssessmentDefinition } from '../../domain/protocol/types';
import type { DesignEntityLocation } from '../../domain/protocol/clinicalDesign';
import type { SoAAssessmentGeneratedImpact, SoAAssessmentVisitAppearance } from './soaAssessmentImpact';
import type { SoAAssessmentValidationEntry } from './soaAssessmentValidationIndex';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface SoAAssessmentDefinitionDetailPanelProps {
  definition: SoAAssessmentDefinition | null;
  clinicalDesignAssessment: DesignEntityLocation | null;
  validation: SoAAssessmentValidationEntry | undefined;
  rules: AssessmentScheduleRule[];
  visitAppearances: SoAAssessmentVisitAppearance[];
  linkedSections: string[];
  generatedImpact: SoAAssessmentGeneratedImpact | null;
  canDelete: boolean;
  deleteBlockedReason: string | null;
  deleteError: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onClearDeleteError: () => void;
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

export function SoAAssessmentDefinitionDetailPanel({
  definition,
  clinicalDesignAssessment,
  validation,
  rules,
  visitAppearances,
  linkedSections,
  generatedImpact,
  canDelete,
  deleteBlockedReason,
  deleteError,
  onEdit,
  onDelete,
  onClearDeleteError,
}: SoAAssessmentDefinitionDetailPanelProps) {
  if (!definition) {
    return (
      <Card className="h-full border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Assessment detail</CardTitle>
          <CardDescription>
            Select a SoA assessment definition to inspect catalog metadata, rules, and generated matrix impact.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const errorCount = validation?.errors.length ?? 0;
  const warningCount = validation?.warnings.length ?? 0;

  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardHeader className="border-b shrink-0 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{definition.label}</CardTitle>
            <CardDescription className="mt-1 truncate">{definition.category}</CardDescription>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="text-xs" onClick={onEdit}>
              Edit
            </Button>
            <AlertDialog
              onOpenChange={(open) => {
                if (!open) {
                  onClearDeleteError();
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  disabled={!canDelete}
                  title={deleteBlockedReason ?? undefined}
                >
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete assessment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove <span className="font-mono">{definition.id}</span> from the SoA assessment catalog.
                    Generated schedule cells for this row will be removed if no rules reference it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{deleteError}</AlertDescription>
                  </Alert>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={(event) => {
                      event.preventDefault();
                      onDelete();
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {!canDelete && deleteBlockedReason ? (
          <p className="text-xs text-muted-foreground pt-1">{deleteBlockedReason}</p>
        ) : null}
        <div className="flex flex-wrap gap-1.5 pt-2">
          <Badge variant="outline" className="text-[10px] font-mono">
            {definition.id}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            Order {definition.order}
          </Badge>
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
            <h4 className="text-sm font-medium mb-2">Catalog metadata</h4>
            <dl className="grid grid-cols-2 gap-3">
              <DetailField label="Id" value={<span className="font-mono">{definition.id}</span>} />
              <DetailField label="Label" value={definition.label} />
              <DetailField label="Category" value={definition.category} />
              <DetailField label="Order" value={definition.order} />
              <DetailField label="Linked section" value={definition.linkedSectionId ?? '—'} />
              <DetailField
                label="Clinical design assessment"
                value={definition.clinicalDesignAssessmentId ?? '—'}
              />
            </dl>
            {definition.metadata && Object.keys(definition.metadata).length > 0 ? (
              <div className="mt-3">
                <DetailField
                  label="Metadata"
                  value={
                    <pre className="text-xs font-mono bg-muted/30 rounded-md p-2 overflow-x-auto">
                      {JSON.stringify(definition.metadata, null, 2)}
                    </pre>
                  }
                />
              </div>
            ) : null}
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-medium mb-2">Linked clinical design assessment</h4>
            {clinicalDesignAssessment ? (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{clinicalDesignAssessment.entity.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {clinicalDesignAssessment.entity.id}
                  </Badge>
                </div>
                {clinicalDesignAssessment.entity.description ? (
                  <p className="text-muted-foreground">{clinicalDesignAssessment.entity.description}</p>
                ) : null}
                {clinicalDesignAssessment.entity.sectionRef ? (
                  <p className="text-xs text-muted-foreground">
                    Section ref: {clinicalDesignAssessment.entity.sectionRef}
                  </p>
                ) : null}
              </div>
            ) : definition.clinicalDesignAssessmentId ? (
              <p className="text-sm text-muted-foreground">
                Clinical design assessment{' '}
                <span className="font-mono">{definition.clinicalDesignAssessmentId}</span> not found in catalog.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No clinical design assessment linked.</p>
            )}
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-medium mb-2">Linked section references</h4>
            {linkedSections.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {linkedSections.map((sectionId) => (
                  <Badge key={sectionId} variant="outline" className="text-[10px] font-mono">
                    {sectionId}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No linked section references.</p>
            )}
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-medium mb-2">Schedule rules ({rules.length})</h4>
            {rules.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Visit</TableHead>
                      <TableHead className="text-xs">Required</TableHead>
                      <TableHead className="text-xs">Timing note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => {
                      const appearance = visitAppearances.find((item) => item.ruleId === rule.id);
                      return (
                        <TableRow key={rule.id}>
                          <TableCell className="text-xs">
                            {appearance?.visitLabel ?? rule.visitDefinitionId}
                          </TableCell>
                          <TableCell className="text-xs">{rule.required ? 'Yes' : 'No'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {rule.timingNote ?? '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No assessment schedule rules reference this catalog row.</p>
            )}
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-medium mb-2">Visits where it appears ({visitAppearances.length})</h4>
            {visitAppearances.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {visitAppearances.map((appearance) => (
                  <Badge key={appearance.ruleId} variant="secondary" className="text-[10px]">
                    {appearance.visitLabel}
                    {appearance.soaColumnId ? ` (${appearance.soaColumnId})` : ''}
                    {appearance.required ? ' • required' : ''}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not scheduled at any visit — row appears in the generated matrix without intersections.
              </p>
            )}
          </section>

          <Separator />

          <section>
            <h4 className="text-sm font-medium mb-2">Generated SoA impact</h4>
            {generatedImpact ? (
              <dl className="grid grid-cols-2 gap-3">
                <DetailField label="Generated row label" value={generatedImpact.generatedRowLabel ?? definition.label} />
                <DetailField
                  label="Generated category"
                  value={generatedImpact.generatedRowCategory ?? definition.category}
                />
                <DetailField label="Schedule rules" value={generatedImpact.ruleCount} />
                <DetailField label="Required rules" value={generatedImpact.requiredRuleCount} />
                <DetailField label="Visit columns with rules" value={generatedImpact.visitCount} />
                <DetailField label="Required cells (cache)" value={generatedImpact.requiredCellCount} />
                <DetailField label="Optional cells (cache)" value={generatedImpact.optionalCellCount} />
                <DetailField
                  label="Generated linked section"
                  value={generatedImpact.generatedLinkedSectionId ?? definition.linkedSectionId ?? '—'}
                />
              </dl>
            ) : null}
            <p className="text-xs text-muted-foreground mt-2">
              Row presence in the matrix is driven by the catalog; cell checkmarks reflect generated cache from schedule
              rules.
            </p>
          </section>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
