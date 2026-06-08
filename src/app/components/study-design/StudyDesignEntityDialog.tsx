import { useEffect, useMemo, useState } from 'react';

import {
  addManualStudyDesignEntity,
  listScheduleAnchors,
  listStudyDesignEpochs,
  listStudyDesignVisits,
  subscribeStudyDesign,
  updateManualStudyDesignEntity,
} from '../../domain/study-design';
import type { StudyDesignEntityFormValues, StudyDesignEntityKind } from '../../domain/study-design/StudyDesignTypes';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export type StudyDesignEditorMode = 'create' | 'edit';

const ENTITY_LABELS: Record<StudyDesignEntityKind, string> = {
  arm: 'Arm',
  epoch: 'Epoch',
  visit: 'Visit',
  activity: 'Activity',
  milestone: 'Milestone',
  anchor: 'Schedule Anchor',
};

const EMPTY_VALUES: StudyDesignEntityFormValues = { name: '' };

function entityToFormValues(entity: Record<string, unknown>): StudyDesignEntityFormValues {
  return {
    name: String(entity.name ?? ''),
    description: entity.description ? String(entity.description) : undefined,
    type: entity.type ? String(entity.type) : undefined,
    visitClass: entity.visitClass ? String(entity.visitClass) : undefined,
    epochId: entity.epochId ? String(entity.epochId) : undefined,
    activityType: entity.activityType ? String(entity.activityType) : undefined,
    milestoneType: entity.milestoneType ? String(entity.milestoneType) : undefined,
    anchorVisitId: entity.anchorVisitId ? String(entity.anchorVisitId) : undefined,
    scheduleAnchorId: entity.scheduleAnchorId ? String(entity.scheduleAnchorId) : undefined,
    offsetDays: typeof entity.offsetDays === 'number' ? entity.offsetDays : undefined,
    offsetUnit: entity.offsetUnit === 'weeks' ? 'weeks' : 'days',
    nominalDay: typeof entity.nominalDay === 'number' ? entity.nominalDay : undefined,
    nominalWeek: typeof entity.nominalWeek === 'number' ? entity.nominalWeek : undefined,
    windowBefore: typeof entity.windowBefore === 'number' ? entity.windowBefore : undefined,
    windowAfter: typeof entity.windowAfter === 'number' ? entity.windowAfter : undefined,
    windowUnit: entity.windowUnit === 'weeks' ? 'weeks' : 'days',
  };
}

interface StudyDesignEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityKind: StudyDesignEntityKind;
  mode?: StudyDesignEditorMode;
  entity?: Record<string, unknown>;
  onSuccess?: () => void;
}

export function StudyDesignEntityDialog({
  open,
  onOpenChange,
  entityKind,
  mode = 'create',
  entity,
  onSuccess,
}: StudyDesignEntityDialogProps) {
  const [values, setValues] = useState<StudyDesignEntityFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribeStudyDesign(() => setRevision((value) => value + 1)), []);

  const epochs = useMemo(() => {
    void revision;
    return listStudyDesignEpochs();
  }, [revision, open]);

  const anchors = useMemo(() => {
    void revision;
    return listScheduleAnchors();
  }, [revision, open]);

  const visits = useMemo(() => {
    void revision;
    return listStudyDesignVisits();
  }, [revision, open]);

  useEffect(() => {
    if (!open) return;
    setValues(entity && mode === 'edit' ? entityToFormValues(entity) : { ...EMPTY_VALUES });
    setError(null);
  }, [open, mode, entity, entityKind]);

  function updateField<K extends keyof StudyDesignEntityFormValues>(field: K, value: StudyDesignEntityFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result =
        mode === 'edit' && entity
          ? updateManualStudyDesignEntity(entityKind, String(entity.id), values)
          : addManualStudyDesignEntity(entityKind, values);
      if (!result.success) {
        setError(result.error ?? 'Could not save entity.');
        return;
      }
      onSuccess?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid={`study-design-entity-dialog-${entityKind}`}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add' : 'Edit'} {ENTITY_LABELS[entityKind]}
          </DialogTitle>
          <DialogDescription>Persist to the canonical Study Design model.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="study-design-name">Name</Label>
            <Input
              id="study-design-name"
              value={values.name}
              onChange={(event) => updateField('name', event.target.value)}
              data-testid="study-design-entity-name-input"
            />
          </div>

          {(entityKind === 'milestone' || entityKind === 'activity') && (
            <div className="space-y-2">
              <Label htmlFor="study-design-description">Description</Label>
              <Textarea
                id="study-design-description"
                value={values.description ?? ''}
                onChange={(event) => updateField('description', event.target.value)}
                rows={2}
              />
            </div>
          )}

          {entityKind === 'arm' && (
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={values.type ?? 'treatment'} onValueChange={(value) => updateField('type', value)}>
                <SelectTrigger data-testid="study-design-arm-type">
                  <SelectValue placeholder="Select arm type" />
                </SelectTrigger>
                <SelectContent>
                  {['treatment', 'placebo', 'observation', 'control', 'other'].map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entityKind === 'visit' && (
            <>
              <div className="space-y-2">
                <Label>Visit class</Label>
                <Select value={values.visitClass ?? 'scheduled'} onValueChange={(value) => updateField('visitClass', value)}>
                  <SelectTrigger data-testid="study-design-visit-class">
                    <SelectValue placeholder="Select visit class" />
                  </SelectTrigger>
                  <SelectContent>
                    {['scheduled', 'unscheduled', 'special', 'nonVisit', 'manual'].map((visitClass) => (
                      <SelectItem key={visitClass} value={visitClass}>{visitClass}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Epoch</Label>
                <Select value={values.epochId ?? ''} onValueChange={(value) => updateField('epochId', value)}>
                  <SelectTrigger data-testid="study-design-visit-epoch">
                    <SelectValue placeholder="Select epoch" />
                  </SelectTrigger>
                  <SelectContent>
                    {epochs.map((epoch) => (
                      <SelectItem key={epoch.id} value={epoch.id}>{epoch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Schedule anchor</Label>
                <Select value={values.scheduleAnchorId ?? ''} onValueChange={(value) => updateField('scheduleAnchorId', value)}>
                  <SelectTrigger data-testid="study-design-visit-anchor">
                    <SelectValue placeholder="Select anchor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {anchors.map((anchor) => (
                      <SelectItem key={anchor.id} value={anchor.id}>{anchor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="study-design-offset-days">Offset (days)</Label>
                  <Input
                    id="study-design-offset-days"
                    type="number"
                    value={values.offsetDays ?? ''}
                    onChange={(event) => updateField('offsetDays', Number.parseInt(event.target.value, 10) || undefined)}
                    data-testid="study-design-visit-offset"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="study-design-nominal-day">Nominal day</Label>
                  <Input
                    id="study-design-nominal-day"
                    type="number"
                    value={values.nominalDay ?? ''}
                    onChange={(event) => updateField('nominalDay', Number.parseInt(event.target.value, 10) || undefined)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="study-design-window-before">Window before</Label>
                  <Input
                    id="study-design-window-before"
                    type="number"
                    value={values.windowBefore ?? ''}
                    onChange={(event) => updateField('windowBefore', Number.parseInt(event.target.value, 10) || undefined)}
                    data-testid="study-design-visit-window-before"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="study-design-window-after">Window after</Label>
                  <Input
                    id="study-design-window-after"
                    type="number"
                    value={values.windowAfter ?? ''}
                    onChange={(event) => updateField('windowAfter', Number.parseInt(event.target.value, 10) || undefined)}
                    data-testid="study-design-visit-window-after"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Window unit</Label>
                  <Select value={values.windowUnit ?? 'days'} onValueChange={(value) => updateField('windowUnit', value as 'days' | 'weeks')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">days</SelectItem>
                      <SelectItem value="weeks">weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {entityKind === 'activity' && (
            <div className="space-y-2">
              <Label>Activity type</Label>
              <Select value={values.activityType ?? 'assessment'} onValueChange={(value) => updateField('activityType', value)}>
                <SelectTrigger data-testid="study-design-activity-type">
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  {['assessment', 'procedure', 'endpoint', 'administrative'].map((activityType) => (
                    <SelectItem key={activityType} value={activityType}>{activityType}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entityKind === 'milestone' && (
            <>
              <div className="space-y-2">
                <Label>Milestone type</Label>
                <Select value={values.milestoneType ?? 'custom'} onValueChange={(value) => updateField('milestoneType', value)}>
                  <SelectTrigger data-testid="study-design-milestone-type">
                    <SelectValue placeholder="Select milestone type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'randomization',
                      'firstDose',
                      'lastDose',
                      'treatmentCompletion',
                      'endOfTreatment',
                      'endOfStudy',
                      'safetyFollowUp',
                      'custom',
                    ].map((milestoneType) => (
                      <SelectItem key={milestoneType} value={milestoneType}>{milestoneType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Anchor visit</Label>
                <Select value={values.anchorVisitId ?? ''} onValueChange={(value) => updateField('anchorVisitId', value)}>
                  <SelectTrigger><SelectValue placeholder="Select visit (optional)" /></SelectTrigger>
                  <SelectContent>
                    {visits.map((visit) => (
                      <SelectItem key={visit.id} value={visit.id}>{visit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={handleSave} data-testid="study-design-entity-save-button">
            {saving ? 'Saving…' : mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
