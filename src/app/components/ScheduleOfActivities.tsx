import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { CheckCircle2, Circle, Link2, Info, Calendar, Users, MapPin, Activity, FileText, Grid3x3, Download } from 'lucide-react';
import type { Visit, Assessment, SoACell } from '../types/protocol';

interface ScheduleOfActivitiesProps {
  visits: Visit[];
  assessments: Assessment[];
  cells: SoACell[];
  onCellClick: (visitId: string, assessmentId: string) => void;
}

export function ScheduleOfActivities({ visits, assessments, cells, onCellClick }: ScheduleOfActivitiesProps) {
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">1.3 Schedule of Activities</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Protocol PROTO-XYZ-301 • {visits.length} visits • {assessments.length} assessments
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Multi-View Editor
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="interactive-grid" className="flex-1 flex flex-col">
        <div className="px-4 pt-3 border-b border-border">
          <TabsList className="h-9 w-full justify-start">
            <TabsTrigger value="study-info" className="text-xs gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Study Info
            </TabsTrigger>
            <TabsTrigger value="epochs" className="text-xs gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Epochs
            </TabsTrigger>
            <TabsTrigger value="arms" className="text-xs gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Arms
            </TabsTrigger>
            <TabsTrigger value="visits" className="text-xs gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Visits
            </TabsTrigger>
            <TabsTrigger value="activities" className="text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Activities
            </TabsTrigger>
            <TabsTrigger value="elements" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Elements
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

        <TabsContent value="epochs" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="min-w-max p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Previous ID</TableHead>
                    <TableHead className="font-semibold">Next ID</TableHead>
                    <TableHead className="font-semibold">Instance Type</TableHead>
                    <TableHead className="text-right font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Epoch_1</TableCell>
                    <TableCell>Screening</TableCell>
                    <TableCell>Screening</TableCell>
                    <TableCell className="text-muted-foreground">None</TableCell>
                    <TableCell>Epoch_2</TableCell>
                    <TableCell>StudyEpoch</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Epoch_2</TableCell>
                    <TableCell>Treatment</TableCell>
                    <TableCell>Treatment</TableCell>
                    <TableCell>Epoch_1</TableCell>
                    <TableCell>Epoch_3</TableCell>
                    <TableCell>StudyEpoch</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Epoch_3</TableCell>
                    <TableCell>Long-term Follow-up</TableCell>
                    <TableCell>Follow-up</TableCell>
                    <TableCell>Epoch_2</TableCell>
                    <TableCell className="text-muted-foreground">None</TableCell>
                    <TableCell>StudyEpoch</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
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

        <TabsContent value="arms" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="min-w-max p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] font-semibold">ID</TableHead>
                    <TableHead className="min-w-[200px] max-w-[300px] font-semibold">Name</TableHead>
                    <TableHead className="w-[150px] font-semibold">Type</TableHead>
                    <TableHead className="min-w-[250px] max-w-[400px] font-semibold">Description</TableHead>
                    <TableHead className="w-[140px] font-semibold">Instance Type</TableHead>
                    <TableHead className="w-[120px] text-right font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium align-top">Arm_1</TableCell>
                    <TableCell className="align-top whitespace-normal">177Lu-PSMA-617 plus Best Standard Care</TableCell>
                    <TableCell className="align-top">Experimental Arm</TableCell>
                    <TableCell className="align-top whitespace-normal">
                      Patients receive 7.4 GBq 177Lu-PSMA-617 IV once every 6 weeks for maximum of 6 cycles plus best standard of care
                    </TableCell>
                    <TableCell className="align-top">StudyArm</TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium align-top">Arm_2</TableCell>
                    <TableCell className="align-top whitespace-normal">Best Standard Care Only</TableCell>
                    <TableCell className="align-top">Control Arm</TableCell>
                    <TableCell className="align-top whitespace-normal">
                      Patients receive best standard of care alone
                    </TableCell>
                    <TableCell className="align-top">StudyArm</TableCell>
                    <TableCell className="text-right align-top">
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

        <TabsContent value="visits" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="min-w-max p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Previous ID</TableHead>
                    <TableHead className="font-semibold">Next ID</TableHead>
                    <TableHead className="font-semibold">Instance Type</TableHead>
                    <TableHead className="text-right font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Encounter_1</TableCell>
                    <TableCell>Screening Visit</TableCell>
                    <TableCell>Screening</TableCell>
                    <TableCell className="text-muted-foreground">None</TableCell>
                    <TableCell>Encounter_2</TableCell>
                    <TableCell>Encounter</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Encounter_2</TableCell>
                    <TableCell>Cycle 1 Day 1</TableCell>
                    <TableCell>Treatment Visit</TableCell>
                    <TableCell>Encounter_1</TableCell>
                    <TableCell>Encounter_3</TableCell>
                    <TableCell>Encounter</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Encounter_3</TableCell>
                    <TableCell>Cycle 1 Day 8</TableCell>
                    <TableCell>Treatment Visit</TableCell>
                    <TableCell>Encounter_2</TableCell>
                    <TableCell>Encounter_4</TableCell>
                    <TableCell>Encounter</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Encounter_4</TableCell>
                    <TableCell>End of Treatment</TableCell>
                    <TableCell>End of Treatment</TableCell>
                    <TableCell>Encounter_3</TableCell>
                    <TableCell>Encounter_5</TableCell>
                    <TableCell>Encounter</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Encounter_5</TableCell>
                    <TableCell>Follow-up Visit</TableCell>
                    <TableCell>Follow-up</TableCell>
                    <TableCell>Encounter_4</TableCell>
                    <TableCell className="text-muted-foreground">None</TableCell>
                    <TableCell>Encounter</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
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

        <TabsContent value="activities" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="min-w-max p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Instance Type</TableHead>
                    <TableHead className="text-right font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Activity_1</TableCell>
                    <TableCell>Physical Examination</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Activity_2</TableCell>
                    <TableCell>Vital Signs</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Activity_3</TableCell>
                    <TableCell>Hematology</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Activity_4</TableCell>
                    <TableCell>Chemistry</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Activity_5</TableCell>
                    <TableCell>ECG</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Activity_6</TableCell>
                    <TableCell>Tumor Assessment (CT/MRI)</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Activity_7</TableCell>
                    <TableCell>PSA Level</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Activity_8</TableCell>
                    <TableCell>Quality of Life Questionnaire</TableCell>
                    <TableCell>Activity</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
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

        <TabsContent value="elements" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="min-w-max p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Label</TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold">Instance Type</TableHead>
                    <TableHead className="text-right font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium align-top">Element_1</TableCell>
                    <TableCell className="align-top">Screening</TableCell>
                    <TableCell className="align-top">Screening Period</TableCell>
                    <TableCell className="align-top">
                      Screening assessments and eligibility confirmation
                    </TableCell>
                    <TableCell className="align-top">StudyElement</TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium align-top">Element_2</TableCell>
                    <TableCell className="align-top">Treatment</TableCell>
                    <TableCell className="align-top">Treatment Period</TableCell>
                    <TableCell className="align-top">
                      Active treatment with study intervention
                    </TableCell>
                    <TableCell className="align-top">StudyElement</TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-500">Valid</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium align-top">Element_3</TableCell>
                    <TableCell className="align-top">Follow-up</TableCell>
                    <TableCell className="align-top">Follow-up Period</TableCell>
                    <TableCell className="align-top">
                      Long-term safety and efficacy follow-up
                    </TableCell>
                    <TableCell className="align-top">StudyElement</TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex items-center justify-end gap-1.5">
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
