import { useEffect, useMemo, useState } from 'react';

import { AlertCircle, AlertTriangle, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';

import { getAssessmentScheduleRulesForAssessment, getProtocolDocument, getSoAAssessmentDefinitions, subscribe } from '../../domain/protocol';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useSoAAssessmentAuthoring } from './SoAAssessmentAuthoringContext';
import { buildSoAAssessmentValidationIndex } from './soaAssessmentValidationIndex';

export function SoAConfigurationAssessmentsTab() {
  const [protocolRevision, setProtocolRevision] = useState(0);
  const {
    selectedAssessmentId,
    setSelectedAssessmentId,
    selectedDefinition,
    canDelete,
    deleteBlockedReason,
    deleteError,
    showNarrativeNotice,
    openCreateEditor,
    openEditEditor,
    handleDelete,
    clearDeleteError,
  } = useSoAAssessmentAuthoring();

  useEffect(() => {
    return subscribe(() => {
      setProtocolRevision((revision) => revision + 1);
    });
  }, []);

  const document = useMemo(() => getProtocolDocument(), [protocolRevision]);
  const definitions = useMemo(
    () => [...getSoAAssessmentDefinitions(document)].sort((left, right) => left.order - right.order),
    [document],
  );
  const validationIndex = useMemo(() => buildSoAAssessmentValidationIndex(document), [document]);

  return (
    <div className="space-y-3">
      {showNarrativeNotice ? (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] shrink-0">
              Governance
            </Badge>
            Narrative impact tracking coming soon.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex flex-col min-h-[360px]">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Assessments</CardTitle>
              <CardDescription>
                Author assessment catalog rows. Details appear in the Metadata panel.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
              <Button size="sm" className="gap-1.5" onClick={openCreateEditor}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={!selectedDefinition}
                onClick={openEditEditor}
              >
                <Pencil className="h-3.5 w-3.5" />
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
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={!selectedDefinition || !canDelete}
                    title={deleteBlockedReason ?? undefined}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete assessment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Remove{' '}
                      <span className="font-medium">{selectedDefinition?.label ?? 'this assessment'}</span> from the
                      catalog.
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
          {!canDelete && deleteBlockedReason && selectedDefinition ? (
            <p className="text-xs text-muted-foreground pt-1">{deleteBlockedReason}</p>
          ) : null}
          <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
            <GripVertical className="h-3.5 w-3.5" />
            Drag-and-drop row ordering coming soon.
          </p>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full max-h-[420px] w-full">
            <div className="min-w-max pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" aria-label="Reorder" />
                    <TableHead className="min-w-[220px]">Label</TableHead>
                    <TableHead className="min-w-[120px]">Category</TableHead>
                    <TableHead className="min-w-[80px] text-right">Rules</TableHead>
                    <TableHead className="min-w-[90px] text-right">Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {definitions.map((definition) => {
                    const validation = validationIndex.get(definition.id);
                    const errorCount = validation?.errors.length ?? 0;
                    const warningCount = validation?.warnings.length ?? 0;
                    const ruleCount = getAssessmentScheduleRulesForAssessment(definition.id, document).length;
                    const isSelected = definition.id === selectedAssessmentId;

                    return (
                      <TableRow
                        key={definition.id}
                        data-state={isSelected ? 'selected' : undefined}
                        className="cursor-pointer data-[state=selected]:bg-accent/40"
                        onClick={() => setSelectedAssessmentId(definition.id)}
                      >
                        <TableCell className="w-10 px-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 cursor-not-allowed opacity-50"
                            disabled
                            title="Drag to reorder coming soon"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{definition.label}</TableCell>
                        <TableCell className="text-xs">{definition.category}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{ruleCount}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
