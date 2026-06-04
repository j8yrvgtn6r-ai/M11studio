import React, { useEffect, useMemo, useState } from 'react';

import { CheckCircle2, Circle, Download, Link2 } from 'lucide-react';

import type { Assessment } from '../../types/protocol';
import { getAssessments, getSoACells, getVisits, subscribe } from '../../domain/protocol';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface GeneratedSoAMatrixProps {
  onCellClick: (visitId: string, assessmentId: string) => void;
}

export function GeneratedSoAMatrix({ onCellClick }: GeneratedSoAMatrixProps) {
  const [scheduleRevision, setScheduleRevision] = useState(0);

  useEffect(() => {
    return subscribe(() => {
      setScheduleRevision((revision) => revision + 1);
    });
  }, []);

  const visits = useMemo(() => getVisits(), [scheduleRevision]);
  const assessments = useMemo(() => getAssessments(), [scheduleRevision]);
  const cells = useMemo(() => getSoACells(), [scheduleRevision]);

  const isCellRequired = (visitId: string, assessmentId: string): boolean => {
    return cells.some(
      (cell) => cell.visitId === visitId && cell.assessmentId === assessmentId && cell.required,
    );
  };

  const assessmentsByCategory = assessments.reduce(
    (acc, assessment) => {
      if (!acc[assessment.category]) {
        acc[assessment.category] = [];
      }
      acc[assessment.category].push(assessment);
      return acc;
    },
    {} as Record<string, Assessment[]>,
  );

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold truncate">Generated SoA Matrix</h3>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            Read-only
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          type="button"
        >
          <Download className="h-4 w-4" />
          Export SoA (USDM JSON)
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="min-w-max p-4">
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
                          {assessment.linkedSectionId ? (
                            <Link2
                              className="h-3 w-3 text-purple-500"
                              title={`Linked to ${assessment.linkedSectionId}`}
                            />
                          ) : null}
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
