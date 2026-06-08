import { useEffect, useMemo, useState } from 'react';

import { Plus } from 'lucide-react';

import {
  getAssessmentScheduleRules,
  getProtocolDocument,
  getSoAAssessmentDefinitions,
  getVisitDefinitions,
  subscribe,
} from '../../domain/protocol';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { SoAEntityEditorDialog } from './SoAEntityEditorDialog';
import { useSoAReadiness } from './useSoAReadiness';

export function SoAConfigurationScheduleRulesPanel() {
  const [protocolRevision, setProtocolRevision] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const { firstPass } = useSoAReadiness();

  useEffect(() => {
    return subscribe(() => setProtocolRevision((value) => value + 1));
  }, []);

  const document = useMemo(() => getProtocolDocument(), [protocolRevision]);
  const rules = useMemo(() => getAssessmentScheduleRules(document), [document]);
  const assessments = useMemo(() => getSoAAssessmentDefinitions(document), [document]);
  const visits = useMemo(() => getVisitDefinitions(document), [document]);
  const assessmentById = useMemo(() => new Map(assessments.map((item) => [item.id, item])), [assessments]);
  const visitById = useMemo(() => new Map(visits.map((item) => [item.id, item])), [visits]);

  return (
    <div className="space-y-4" data-testid="soa-schedule-rules-panel">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Schedule rules</CardTitle>
              <CardDescription>
                Assessment × visit intersections from <span className="font-mono">assessmentScheduleRules</span> drive the Matrix projection.
              </CardDescription>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setEditorOpen(true)} data-testid="soa-add-scheduleRule-button">
              <Plus className="h-4 w-4" />
              Add Schedule Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground"
              data-testid="soa-empty-state-scheduleRule"
            >
              <p>No schedule rules have been created yet. Add a rule manually or generate a first-pass SoA after protocol knowledge is available.</p>
              {!firstPass.ready ? (
                <p className="mt-3 text-xs">Add protocol content or import a protocol before generating a first-pass SoA.</p>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Visit</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead className="font-mono text-xs">Id</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{assessmentById.get(rule.assessmentId)?.label ?? rule.assessmentId}</TableCell>
                    <TableCell>{visitById.get(rule.visitDefinitionId)?.name ?? rule.visitDefinitionId}</TableCell>
                    <TableCell>
                      <Badge variant={rule.required ? 'default' : 'outline'} className="text-[10px]">
                        {rule.required ? 'Required' : 'Optional'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{rule.id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SoAEntityEditorDialog
        open={editorOpen}
        mode="create"
        entityKind="scheduleRule"
        onOpenChange={setEditorOpen}
        onSuccess={() => setProtocolRevision((value) => value + 1)}
      />
    </div>
  );
}
