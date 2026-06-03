import React, { useEffect, useMemo, useState } from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

import { ScrollArea, ScrollBar } from './ui/scroll-area';

import { Badge } from './ui/badge';

import { Button } from './ui/button';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

import { CheckCircle2, Circle, Link2, Info, Grid3x3, Download } from 'lucide-react';

import type { Assessment } from '../types/protocol';

import { getAssessments, getSchedule, getSoACells, getVisits, subscribe } from '../domain/protocol';



interface ScheduleOfActivitiesProps {

  onCellClick: (visitId: string, assessmentId: string) => void;

}



function formatGeneratedAt(value: string): string {

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {

    return value;

  }



  return parsed.toLocaleString();

}



export function ScheduleOfActivities({ onCellClick }: ScheduleOfActivitiesProps) {

  const [scheduleRevision, setScheduleRevision] = useState(0);



  useEffect(() => {

    return subscribe(() => {

      setScheduleRevision((revision) => revision + 1);

    });

  }, []);



  const visits = useMemo(() => getVisits(), [scheduleRevision]);

  const assessments = useMemo(() => getAssessments(), [scheduleRevision]);

  const cells = useMemo(() => getSoACells(), [scheduleRevision]);

  const scheduleMetadata = useMemo(() => getSchedule().metadata, [scheduleRevision]);



  const isCellRequired = (visitId: string, assessmentId: string): boolean => {

    return cells.some((cell) => cell.visitId === visitId && cell.assessmentId === assessmentId && cell.required);

  };



  const assessmentsByCategory = assessments.reduce(

    (acc, assessment) => {

      if (!acc[assessment.category]) {

        acc[assessment.category] = [];

      }

      acc[assessment.category].push(assessment);

      return acc;

    },

    {} as Record<string, Assessment[]>

  );



  return (

    <div className="flex flex-col h-full bg-background">

      <div className="px-4 py-3 border-b border-border bg-card">

        <div className="flex items-start justify-between gap-4">

          <div>

            <h2 className="font-semibold">1.3 Schedule of Activities</h2>

            <p className="text-xs text-muted-foreground mt-0.5">

              Protocol PROTO-XYZ-301 • {visits.length} visits • {assessments.length} assessments

            </p>

          </div>

          {scheduleMetadata?.generatedFromRules ? (

            <Badge variant="outline" className="text-xs">

              Generated cache

              {scheduleMetadata.generatedAt

                ? ` • updated ${formatGeneratedAt(scheduleMetadata.generatedAt)}`

                : ''}

            </Badge>

          ) : null}

        </div>

      </div>



      <Tabs defaultValue="interactive-grid" className="flex-1 flex flex-col">
        <div className="px-4 pt-3 border-b border-border">
          <TabsList className="h-9 w-full justify-start">
            <TabsTrigger value="study-info" className="text-xs gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Study Info
            </TabsTrigger>
            <TabsTrigger value="interactive-grid" className="text-xs gap-1.5">
              <Grid3x3 className="h-3.5 w-3.5" />
              Interactive Grid
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="study-info" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="min-w-max p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px] font-semibold">Field</TableHead>
                    <TableHead className="min-w-[300px] max-w-[500px] font-semibold">Value</TableHead>
                    <TableHead className="w-[120px] text-right font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Study ID</TableCell>
                    <TableCell className="whitespace-normal">PSMA617-01</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Study Name</TableCell>
                    <TableCell className="whitespace-normal">
                      Phase 3 Study of 177Lu-PSMA-617 in Metastatic Castration-Resistant Prostate Cancer
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium align-top">Description</TableCell>
                    <TableCell className="whitespace-normal">
                      A Phase 3, open-label, international, randomized study to evaluate the efficacy and safety of 177Lu-PSMA-617 in patients with progressive PSMA-positive mCRPC
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Instance Type</TableCell>
                    <TableCell className="whitespace-normal">Study</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="interactive-grid" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="min-w-max p-4">
              <div className="flex justify-end mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 transition-all hover:scale-105 hover:shadow-md"
                >
                  <Download className="h-4 w-4" />
                  Export SoA (USDM JSON)
                </Button>
              </div>
              <div className="min-w-max">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-card min-w-[200px] font-semibold">
                        Assessment / Procedure
                      </TableHead>
                      {visits.map((visit) => (
                        <TableHead key={visit.id} className="text-center min-w-[100px]">
                          <div className="font-semibold">{visit.label}</div>
                          <div className="text-xs text-muted-foreground font-normal">{visit.timepoint}</div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(assessmentsByCategory).map(([category, categoryAssessments]) => (
                      <React.Fragment key={`category-${category}`}>
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={visits.length + 1} className="font-semibold text-sm sticky left-0 z-10">
                            {category}
                          </TableCell>
                        </TableRow>
                        {categoryAssessments.map((assessment) => (
                          <TableRow key={assessment.id} className="hover:bg-muted/30">
                            <TableCell className="sticky left-0 z-10 bg-card">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{assessment.label}</span>
                                {assessment.linkedSectionId && (
                                  <Link2 className="h-3 w-3 text-purple-500" title={`Linked to ${assessment.linkedSectionId}`} />
                                )}
                              </div>
                            </TableCell>
                            {visits.map((visit) => {
                              const required = isCellRequired(visit.id, assessment.id);
                              return (
                                <TableCell
                                  key={`${visit.id}-${assessment.id}`}
                                  className="text-center cursor-pointer hover:bg-accent/50 transition-colors"
                                  onClick={() => onCellClick(visit.id, assessment.id)}
                                >
                                  {required ? (
                                    <div className="flex justify-center">
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    </div>
                                  ) : (
                                    <div className="flex justify-center opacity-20 hover:opacity-50">
                                      <Circle className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
