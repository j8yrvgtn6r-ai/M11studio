import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';

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
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useSoAAssessmentAuthoringOptional } from './SoAAssessmentAuthoringContext';

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

export function SoAAssessmentMetadataPanel() {
  const authoring = useSoAAssessmentAuthoringOptional();

  if (!authoring) {
    return null;
  }

  const {
    selectedDefinition,
    selectedValidation,
    selectedRules,
    selectedClinicalDesign,
    selectedVisitAppearances,
    selectedLinkedSections,
    selectedGeneratedImpact,
    canDelete,
    deleteBlockedReason,
    deleteError,
    openEditEditor,
    handleDelete,
    clearDeleteError,
  } = authoring;

  if (!selectedDefinition) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <p>Select an assessment in the Assessments tab to view details.</p>
      </div>
    );
  }

  const errorCount = selectedValidation?.errors.length ?? 0;
  const warningCount = selectedValidation?.warnings.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{selectedDefinition.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{selectedDefinition.category}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={openEditEditor}>
            Edit
          </Button>
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) {
                clearDeleteError();
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 text-destructive hover:text-destructive"
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
                  Remove <span className="font-medium">{selectedDefinition.label}</span> from the assessment catalog.
                  This cannot be undone while schedule rules reference the assessment.
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
                    handleDelete();
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
        <p className="text-xs text-muted-foreground">{deleteBlockedReason}</p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[10px]">
          {selectedDefinition.category}
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

      {(selectedValidation?.errors.length ?? 0) > 0 || (selectedValidation?.warnings.length ?? 0) > 0 ? (
        <div className="space-y-2">
          {selectedValidation?.errors.map((message) => (
            <Alert key={`${message.code}-${message.path}`} variant="destructive">
              <AlertCircle />
              <AlertTitle className="text-xs">{message.code}</AlertTitle>
              <AlertDescription>{message.message}</AlertDescription>
            </Alert>
          ))}
          {selectedValidation?.warnings.map((message) => (
            <Alert key={`${message.code}-${message.path}`}>
              <AlertTriangle />
              <AlertTitle className="text-xs">{message.code}</AlertTitle>
              <AlertDescription>{message.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Assessment details</h4>
        <dl className="grid grid-cols-1 gap-3">
          <DetailField label="Assessment name" value={selectedDefinition.label} />
          <DetailField label="Category" value={selectedDefinition.category} />
          <DetailField label="Schedule rules" value={selectedRules.length} />
        </dl>
      </section>

      <details className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground">Technical identifiers</summary>
        <dl className="mt-2 space-y-2 font-mono text-[11px] text-muted-foreground">
          <div>
            <dt className="uppercase tracking-wide">Catalog id</dt>
            <dd>{selectedDefinition.id}</dd>
          </div>
          {selectedDefinition.linkedSectionId ? (
            <div>
              <dt className="uppercase tracking-wide">Linked section</dt>
              <dd>{selectedDefinition.linkedSectionId}</dd>
            </div>
          ) : null}
          {selectedDefinition.clinicalDesignAssessmentId ? (
            <div>
              <dt className="uppercase tracking-wide">Clinical design ref</dt>
              <dd>{selectedDefinition.clinicalDesignAssessmentId}</dd>
            </div>
          ) : null}
        </dl>
      </details>

      {selectedClinicalDesign ? (
        <>
          <Separator />
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Linked clinical activity</h4>
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-sm">
              <p className="font-medium">{selectedClinicalDesign.entity.name}</p>
              {selectedClinicalDesign.entity.description ? (
                <p className="text-muted-foreground text-xs">{selectedClinicalDesign.entity.description}</p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {selectedLinkedSections.length > 0 ? (
        <>
          <Separator />
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Linked protocol sections</h4>
            <p className="text-sm">{selectedLinkedSections.join(', ')}</p>
          </section>
        </>
      ) : null}

      <Separator />

      <section>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">
          Visits ({selectedVisitAppearances.length})
        </h4>
        {selectedVisitAppearances.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedVisitAppearances.map((appearance) => (
              <Badge key={appearance.ruleId} variant="secondary" className="text-[10px]">
                {appearance.visitLabel}
                {appearance.required ? ' • required' : ''}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not scheduled at any visit yet.</p>
        )}
      </section>

      {selectedRules.length > 0 ? (
        <>
          <Separator />
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Schedule rules</h4>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Visit</TableHead>
                    <TableHead className="text-xs">Required</TableHead>
                    <TableHead className="text-xs">Timing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRules.map((rule) => {
                    const appearance = selectedVisitAppearances.find((item) => item.ruleId === rule.id);
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="text-xs">
                          {appearance?.visitLabel ?? rule.visitDefinitionId}
                        </TableCell>
                        <TableCell className="text-xs">{rule.required ? 'Yes' : 'No'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{rule.timingNote ?? '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : null}

      {selectedGeneratedImpact ? (
        <>
          <Separator />
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Generated matrix impact</h4>
            <dl className="grid grid-cols-2 gap-3">
              <DetailField label="Required cells" value={selectedGeneratedImpact.requiredCellCount} />
              <DetailField label="Optional cells" value={selectedGeneratedImpact.optionalCellCount} />
              <DetailField label="Visit columns" value={selectedGeneratedImpact.visitCount} />
            </dl>
          </section>
        </>
      ) : null}
    </div>
  );
}
