import { useEffect, useMemo, useState } from 'react';

import { AlertCircle, AlertTriangle } from 'lucide-react';

import {
  findDesignEntityInDocument,
  getAssessmentScheduleRulesForAssessment,
  getAssessments,
  getProtocolDocument,
  getSoACells,
  getSoAAssessmentDefinitions,
  getVisitDefinitions,
  subscribe,
} from '../../domain/protocol';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { SoAAssessmentDefinitionDetailPanel } from './SoAAssessmentDefinitionDetailPanel';
import {
  buildAssessmentVisitAppearances,
  collectLinkedSectionReferences,
  computeSoAAssessmentGeneratedImpact,
} from './soaAssessmentImpact';
import { buildSoAAssessmentValidationIndex } from './soaAssessmentValidationIndex';

export function SoAConfigurationAssessmentsTab() {
  const [protocolRevision, setProtocolRevision] = useState(0);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

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
  const visitById = useMemo(
    () => new Map(getVisitDefinitions(document).map((visit) => [visit.id, visit])),
    [document],
  );
  const generatedAssessments = useMemo(() => getAssessments(document), [document]);
  const generatedCells = useMemo(() => getSoACells(document), [document]);

  useEffect(() => {
    if (definitions.length === 0) {
      setSelectedAssessmentId(null);
      return;
    }
    if (!selectedAssessmentId || !definitions.some((definition) => definition.id === selectedAssessmentId)) {
      setSelectedAssessmentId(definitions[0].id);
    }
  }, [definitions, selectedAssessmentId]);

  const selectedDefinition = definitions.find((definition) => definition.id === selectedAssessmentId) ?? null;
  const selectedRules = selectedDefinition
    ? getAssessmentScheduleRulesForAssessment(selectedDefinition.id, document)
    : [];
  const selectedValidation = selectedDefinition ? validationIndex.get(selectedDefinition.id) : undefined;
  const selectedClinicalDesign = selectedDefinition?.clinicalDesignAssessmentId
    ? findDesignEntityInDocument(document, selectedDefinition.clinicalDesignAssessmentId)
    : null;
  const selectedVisitAppearances = buildAssessmentVisitAppearances(selectedRules, visitById);
  const selectedLinkedSections = selectedDefinition
    ? collectLinkedSectionReferences(selectedDefinition.linkedSectionId, selectedRules)
    : [];
  const selectedGeneratedImpact = selectedDefinition
    ? computeSoAAssessmentGeneratedImpact(
        selectedDefinition.id,
        selectedRules,
        generatedCells,
        generatedAssessments,
      )
    : null;

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[360px]">
      <Card className="flex-[3] min-w-0 flex flex-col min-h-[360px]">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base">SoA assessment definitions</CardTitle>
          <CardDescription>
            Read-only catalog from <span className="font-mono">soaAssessmentDefinitions</span> ({definitions.length})
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
          <ScrollArea className="h-full max-h-[360px]">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[70px] font-mono text-xs">Id</TableHead>
                    <TableHead className="min-w-[160px]">Label</TableHead>
                    <TableHead className="min-w-[100px]">Category</TableHead>
                    <TableHead className="min-w-[60px] text-right">Order</TableHead>
                    <TableHead className="min-w-[90px] font-mono text-xs">Section</TableHead>
                    <TableHead className="min-w-[120px] font-mono text-xs">Clinical design</TableHead>
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
                        <TableCell className="font-mono text-xs">{definition.id}</TableCell>
                        <TableCell className="font-medium text-sm">{definition.label}</TableCell>
                        <TableCell className="text-xs">{definition.category}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{definition.order}</TableCell>
                        <TableCell className="font-mono text-xs">{definition.linkedSectionId ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {definition.clinicalDesignAssessmentId ?? '—'}
                        </TableCell>
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

      <div className="flex-[2] min-w-[280px] min-h-[360px]">
        <SoAAssessmentDefinitionDetailPanel
          definition={selectedDefinition}
          clinicalDesignAssessment={selectedClinicalDesign}
          validation={selectedValidation}
          rules={selectedRules}
          visitAppearances={selectedVisitAppearances}
          linkedSections={selectedLinkedSections}
          generatedImpact={selectedGeneratedImpact}
        />
      </div>
    </div>
  );
}
