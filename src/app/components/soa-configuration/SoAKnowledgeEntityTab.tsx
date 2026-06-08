import { useEffect, useMemo, useState } from 'react';

import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  deleteManualSoAEntity,
  entityToFormValues,
  listKnowledgeEntities,
} from '../../domain/soa-knowledge/soaManualAuthoringService';
import { validateSoAKnowledgeIntegrity } from '../../domain/soa-knowledge/soaKnowledgeIntegrity';
import { getCurrentSoANarrativeSyncProposal } from '../../domain/soa-knowledge/soaNarrativeSyncStore';
import { subscribeSoAKnowledge } from '../../domain/soa-knowledge/soaKnowledgeStore';
import type { SoAEntityEditorKind } from '../../domain/soa-knowledge/soaEntityValidation';
import { subscribe } from '../../domain/protocol';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { SoAConfigurationTabDefinition } from './soaConfigurationTabs';
import { SoAEntityEditorDialog, type SoAEntityEditorMode } from './SoAEntityEditorDialog';
import { useSoAReadiness } from './useSoAReadiness';

const ADD_LABELS: Partial<Record<SoAEntityEditorKind, string>> = {
  epoch: 'Add Epoch',
  arm: 'Add Arm',
  visit: 'Add Visit',
  activity: 'Add Activity',
  element: 'Add Element',
  assessment: 'Add Assessment',
  condition: 'Add Condition / Rule',
  scheduleRule: 'Add Schedule Rule',
  milestone: 'Add Milestone',
};

const ENTITY_KIND_BY_TAB: Partial<Record<SoAConfigurationTabDefinition['id'], SoAEntityEditorKind>> = {
  epochs: 'epoch',
  arms: 'arm',
  visits: 'visit',
  activities: 'activity',
  elements: 'element',
  milestones: 'milestone',
  'soa-assessments': 'assessment',
  'conditional-logic': 'condition',
};

const EMPTY_STATE_COPY: Partial<Record<SoAEntityEditorKind, string>> = {
  epoch: 'No epochs have been created yet. Add an epoch manually or generate a first-pass SoA after protocol knowledge is available.',
  arm: 'No arms have been created yet. Add an arm manually or generate a first-pass SoA after protocol knowledge is available.',
  visit: 'No visits have been created yet. Add a visit manually or generate a first-pass SoA after protocol knowledge is available.',
  activity: 'No activities have been created yet. Add an activity manually or generate a first-pass SoA after protocol knowledge is available.',
  element: 'No elements have been created yet. Add an element manually or generate a first-pass SoA after protocol knowledge is available.',
  assessment: 'No assessments exist in SoA Knowledge yet. Use the Assessments tab catalog or add an assessment here.',
  condition: 'No conditional logic entries exist yet. Add a condition manually or generate a first-pass SoA after protocol knowledge is available.',
  milestone: 'No milestones have been created yet. Add a milestone to anchor visits on the study timeline.',
};

function entityDisplayName(entity: Record<string, unknown>): string {
  if ('name' in entity && entity.name) {
    return String(entity.name);
  }
  if ('label' in entity && entity.label) {
    return String(entity.label);
  }
  return String(entity.id);
}

interface SoAKnowledgeEntityTabProps {
  tab: SoAConfigurationTabDefinition;
}

export function SoAKnowledgeEntityTab({ tab }: SoAKnowledgeEntityTabProps) {
  const entityKind = ENTITY_KIND_BY_TAB[tab.id];
  const [revision, setRevision] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<SoAEntityEditorMode>('create');
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>();
  const [initialValues, setInitialValues] = useState<ReturnType<typeof entityToFormValues> | undefined>();
  const { firstPass } = useSoAReadiness();
  const narrativeSync = getCurrentSoANarrativeSyncProposal();

  useEffect(() => {
    const unsubKnowledge = subscribeSoAKnowledge(() => setRevision((value) => value + 1));
    const unsubProtocol = subscribe(() => setRevision((value) => value + 1));
    return () => {
      unsubKnowledge();
      unsubProtocol();
    };
  }, []);

  const entities = useMemo(() => {
    if (!entityKind) {
      return [];
    }
    void revision;
    return listKnowledgeEntities(entityKind) as Array<Record<string, unknown>>;
  }, [entityKind, revision]);

  const integrityIssues = useMemo(() => {
    void revision;
    return validateSoAKnowledgeIntegrity();
  }, [revision]);

  if (!entityKind) {
    return null;
  }

  const addLabel = ADD_LABELS[entityKind] ?? 'Add';

  function openCreate() {
    setEditorMode('create');
    setSelectedEntityId(undefined);
    setInitialValues(undefined);
    setEditorOpen(true);
  }

  function openEdit(entity: Record<string, unknown>) {
    setEditorMode('edit');
    setSelectedEntityId(String(entity.id));
    setInitialValues(entityToFormValues(entityKind!, entity));
    setEditorOpen(true);
  }

  function handleDelete(entityId: string) {
    const result = deleteManualSoAEntity(entityKind!, entityId);
    if (result.success) {
      setRevision((value) => value + 1);
    }
  }

  return (
    <div className="space-y-4" data-testid={`soa-entity-tab-${tab.id}`}>
      {narrativeSync?.status === 'proposed' ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-3 text-xs text-amber-800 dark:text-amber-200">
            Narrative sync proposal pending — review impacted sections after SoA builder edits.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{tab.label}</CardTitle>
              <CardDescription>{tab.description}</CardDescription>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={openCreate} data-testid={`soa-add-${entityKind}-button`}>
              <Plus className="h-4 w-4" />
              {addLabel}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entities.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground"
              data-testid={`soa-empty-state-${entityKind}`}
            >
              <p>{EMPTY_STATE_COPY[entityKind]}</p>
              {!firstPass.ready ? (
                <p className="mt-3 text-xs">Add protocol content or import a protocol before generating a first-pass SoA.</p>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provenance</TableHead>
                  <TableHead>Sync</TableHead>
                  <TableHead className="font-mono text-xs">Id</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((entity) => {
                  const entityId = String(entity.id);
                  const entityIssues = integrityIssues.filter((issue) => issue.field.includes(entityId));
                  return (
                    <TableRow key={entityId}>
                      <TableCell className="font-medium">{entityDisplayName(entity)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]" data-testid="soa-provenance-badge">
                          {String(entity.inferenceSource ?? 'unknown')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-[10px] gap-0.5" data-testid="soa-kg-sync-badge">
                            <Link2 className="h-3 w-3" />
                            KG
                          </Badge>
                          {entityIssues.length > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-700">
                              {entityIssues.length} warn
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entityId}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(entity)} data-testid={`soa-edit-${entityKind}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(entityId)} data-testid={`soa-delete-${entityKind}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SoAEntityEditorDialog
        open={editorOpen}
        mode={editorMode}
        entityKind={entityKind}
        entityId={selectedEntityId}
        initialValues={initialValues}
        onOpenChange={setEditorOpen}
        onSuccess={() => setRevision((value) => value + 1)}
      />
    </div>
  );
}
