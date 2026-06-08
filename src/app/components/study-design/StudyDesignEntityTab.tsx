import { useEffect, useMemo, useState } from 'react';

import { Pencil, Plus, Trash2 } from 'lucide-react';

import {
  deleteManualStudyDesignEntity,
  listStudyDesignEntities,
  subscribeStudyDesign,
} from '../../domain/study-design';
import { getCurrentNarrativeImpactProposal, subscribeStudyDesignProposals } from '../../domain/study-design/studyDesignProposalStore';
import type { StudyDesignEntityKind } from '../../domain/study-design/StudyDesignTypes';
import type { SoAConfigurationTabDefinition } from '../soa-configuration/soaConfigurationTabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { StudyDesignEntityDialog, type StudyDesignEditorMode } from './StudyDesignEntityDialog';

const ENTITY_KIND_BY_TAB: Partial<Record<SoAConfigurationTabDefinition['id'], StudyDesignEntityKind>> = {
  arms: 'arm',
  epochs: 'epoch',
  visits: 'visit',
  activities: 'activity',
  milestones: 'milestone',
};

const ADD_LABELS: Partial<Record<StudyDesignEntityKind, string>> = {
  arm: 'Add Arm',
  epoch: 'Add Epoch',
  visit: 'Add Visit',
  activity: 'Add Activity',
  milestone: 'Add Milestone',
};

const EMPTY_COPY: Partial<Record<StudyDesignEntityKind, string>> = {
  arm: 'No arms defined yet. Add manually or build Study Design from protocol sources.',
  epoch: 'No epochs defined yet. Epochs sequence Screening, Treatment, Follow-up, and other study periods.',
  visit: 'No visits defined yet. Add a visit with epoch, optional anchor, offset, and visit windows.',
  activity: 'No activities defined yet. Activities become SoA rows when first-pass SoA is generated.',
  milestone: 'No milestones defined yet. Milestones anchor Randomization, First Dose, End of Study, and other protocol events.',
};

function entitySubtitle(entity: Record<string, unknown>, kind: StudyDesignEntityKind): string {
  if (kind === 'visit') {
    const parts: string[] = [];
    if (entity.nominalDay != null) parts.push(`Day ${entity.nominalDay}`);
    if (entity.nominalWeek != null) parts.push(`Week ${entity.nominalWeek}`);
    if (entity.windowBefore != null || entity.windowAfter != null) {
      parts.push(`-${entity.windowBefore ?? 0}/+${entity.windowAfter ?? 0}`);
    }
    return parts.join(' · ') || String(entity.visitClass ?? '');
  }
  if (kind === 'milestone') {
    return String(entity.milestoneType ?? '');
  }
  if (kind === 'activity') {
    return String(entity.activityType ?? '');
  }
  if (kind === 'arm') {
    return String(entity.type ?? '');
  }
  return '';
}

interface StudyDesignEntityTabProps {
  tab: SoAConfigurationTabDefinition;
}

export function StudyDesignEntityTab({ tab }: StudyDesignEntityTabProps) {
  const entityKind = ENTITY_KIND_BY_TAB[tab.id];
  const [revision, setRevision] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<StudyDesignEditorMode>('create');
  const [selectedEntity, setSelectedEntity] = useState<Record<string, unknown> | undefined>();

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    const unsubDesign = subscribeStudyDesign(bump);
    const unsubProposals = subscribeStudyDesignProposals(bump);
    return () => {
      unsubDesign();
      unsubProposals();
    };
  }, []);

  const entities = useMemo(() => {
    if (!entityKind) return [];
    void revision;
    return listStudyDesignEntities(entityKind) as Array<Record<string, unknown>>;
  }, [entityKind, revision]);

  const narrativeImpact = useMemo(() => {
    void revision;
    return getCurrentNarrativeImpactProposal();
  }, [revision]);

  if (!entityKind) return null;

  function openCreate() {
    setEditorMode('create');
    setSelectedEntity(undefined);
    setDialogOpen(true);
  }

  function openEdit(entity: Record<string, unknown>) {
    setEditorMode('edit');
    setSelectedEntity(entity);
    setDialogOpen(true);
  }

  function handleDelete(entityId: string) {
    deleteManualStudyDesignEntity(entityKind!, entityId);
    setRevision((value) => value + 1);
  }

  return (
    <div className="space-y-4" data-testid={`study-design-tab-${tab.id}`}>
      {narrativeImpact?.status === 'proposed' ? (
        <Card className="border-amber-500/40 bg-amber-500/5" data-testid="study-design-narrative-impact-warning">
          <CardContent className="py-3 text-xs text-amber-800 dark:text-amber-200">
            {narrativeImpact.message} Sections: {narrativeImpact.impactedSectionIds.join(', ')}.
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
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={openCreate}
              data-testid={`study-design-add-${entityKind}-button`}
            >
              <Plus className="h-4 w-4" />
              {ADD_LABELS[entityKind]}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entities.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground"
              data-testid={`study-design-empty-state-${entityKind}`}
            >
              {EMPTY_COPY[entityKind]}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((entity) => (
                  <TableRow key={String(entity.id)}>
                    <TableCell className="font-medium">{String(entity.name)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entitySubtitle(entity, entityKind)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {String((entity.provenance as { source?: string })?.source ?? 'unknown')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(entity)} data-testid={`study-design-edit-${entityKind}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(String(entity.id))} data-testid={`study-design-delete-${entityKind}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StudyDesignEntityDialog
        open={dialogOpen}
        mode={editorMode}
        entityKind={entityKind}
        entity={selectedEntity}
        onOpenChange={setDialogOpen}
        onSuccess={() => setRevision((value) => value + 1)}
      />
    </div>
  );
}
