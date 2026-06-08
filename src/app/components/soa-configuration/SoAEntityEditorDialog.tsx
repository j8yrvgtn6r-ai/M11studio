import { useEffect, useMemo, useState } from 'react';

import {
  getProtocolDocument,
  getScheduleAnchors,
  getSoAAssessmentDefinitions,
  getVisitDefinitions,
} from '../../domain/protocol';
import type { SoAEntityEditorKind, SoAEntityFormValues, SoAEntityValidationIssue } from '../../domain/soa-knowledge/soaEntityValidation';
import {
  hasBlockingValidationIssues,
  validateSoAEntityForm,
} from '../../domain/soa-knowledge/soaEntityValidation';
import { listKnowledgeEntities, saveManualSoAEntity } from '../../domain/soa-knowledge/soaManualAuthoringService';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';

export type SoAEntityEditorMode = 'create' | 'edit';

const ENTITY_LABELS: Record<SoAEntityEditorKind, string> = {
  epoch: 'Epoch',
  arm: 'Arm',
  visit: 'Visit',
  activity: 'Activity',
  element: 'Element',
  assessment: 'Assessment',
  condition: 'Condition',
  scheduleRule: 'Schedule Rule',
  milestone: 'Milestone',
};

interface SoAEntityEditorDialogProps {
  open: boolean;
  mode: SoAEntityEditorMode;
  entityKind: SoAEntityEditorKind;
  initialValues?: Partial<SoAEntityFormValues>;
  entityId?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (entityId: string, markedSections: string[]) => void;
}

const EMPTY_VALUES: SoAEntityFormValues = {
  name: '',
  description: '',
  code: '',
  notes: '',
  required: true,
};

export function SoAEntityEditorDialog({
  open,
  mode,
  entityKind,
  initialValues,
  entityId,
  onOpenChange,
  onSuccess,
}: SoAEntityEditorDialogProps) {
  const [values, setValues] = useState<SoAEntityFormValues>(EMPTY_VALUES);
  const [issues, setIssues] = useState<SoAEntityValidationIssue[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const document = useMemo(() => getProtocolDocument(), [open]);
  const anchors = useMemo(() => getScheduleAnchors(document), [document]);
  const visits = useMemo(() => getVisitDefinitions(document), [document]);
  const assessments = useMemo(() => getSoAAssessmentDefinitions(document), [document]);
  const knowledgeEpochs = useMemo(() => listKnowledgeEntities('epoch'), [open]);
  const knowledgeArms = useMemo(() => listKnowledgeEntities('arm'), [open]);
  const knowledgeMilestones = useMemo(() => listKnowledgeEntities('milestone'), [open]);
  const knowledgeVisits = useMemo(() => listKnowledgeEntities('visit'), [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSaveError(null);
    setIssues([]);
    setValues({ ...EMPTY_VALUES, ...initialValues });
  }, [open, mode, entityKind, initialValues]);

  function updateField<K extends keyof SoAEntityFormValues>(field: K, value: SoAEntityFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSave() {
    const validationIssues = validateSoAEntityForm(entityKind, values, document);
    setIssues(validationIssues);
    if (hasBlockingValidationIssues(validationIssues)) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = saveManualSoAEntity(entityKind, values, { entityId });
      if (!result.success) {
        setSaveError(result.error ?? 'Could not save entity.');
        return;
      }
      onSuccess?.(result.entityId ?? entityId ?? values.code ?? values.name, result.markedSections);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const errors = issues.filter((issue) => issue.severity === 'error');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid={`soa-entity-editor-${entityKind}`}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add' : 'Edit'} {ENTITY_LABELS[entityKind]}
          </DialogTitle>
          <DialogDescription>
            Manual entries are marked user-created and sync to SoA Knowledge{entityKind === 'assessment' || entityKind === 'visit' || entityKind === 'scheduleRule' ? ', SoA Configuration,' : ''} and the Knowledge Graph where applicable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="soa-entity-name">Name</Label>
            <Input
              id="soa-entity-name"
              value={values.name}
              onChange={(event) => updateField('name', event.target.value)}
              data-testid="soa-entity-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="soa-entity-description">Description</Label>
            <Textarea
              id="soa-entity-description"
              value={values.description ?? ''}
              onChange={(event) => updateField('description', event.target.value)}
              rows={2}
            />
          </div>

          {mode === 'create' ? (
            <div className="space-y-2">
              <Label htmlFor="soa-entity-code">Code / Id (optional)</Label>
              <Input
                id="soa-entity-code"
                value={values.code ?? ''}
                onChange={(event) => updateField('code', event.target.value)}
              />
            </div>
          ) : null}

          {(entityKind === 'epoch' || entityKind === 'element' || entityKind === 'activity') && (
            <div className="space-y-2">
              <Label htmlFor="soa-entity-order">Order</Label>
              <Input
                id="soa-entity-order"
                type="number"
                value={values.order ?? ''}
                onChange={(event) => updateField('order', Number.parseInt(event.target.value, 10) || undefined)}
              />
            </div>
          )}

          {entityKind === 'epoch' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-epoch-type">Epoch type</Label>
                <Input id="soa-entity-epoch-type" value={values.epochType ?? ''} onChange={(event) => updateField('epochType', event.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="soa-entity-start-milestone">Start milestone</Label>
                  <Input id="soa-entity-start-milestone" value={values.startAnchor ?? ''} onChange={(event) => updateField('startAnchor', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soa-entity-end-milestone">End milestone</Label>
                  <Input id="soa-entity-end-milestone" value={values.endAnchor ?? ''} onChange={(event) => updateField('endAnchor', event.target.value)} />
                </div>
              </div>
            </>
          )}

          {entityKind === 'arm' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-arm-type">Arm type</Label>
                <Input id="soa-entity-arm-type" value={values.armType ?? ''} onChange={(event) => updateField('armType', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-intervention">Linked intervention</Label>
                <Input
                  id="soa-entity-intervention"
                  value={values.intervention ?? ''}
                  onChange={(event) => updateField('intervention', event.target.value)}
                />
              </div>
            </>
          )}

          {entityKind === 'element' && (
            <>
              <div className="space-y-2">
                <Label>Epoch</Label>
                <Select value={values.epochId ?? ''} onValueChange={(value) => updateField('epochId', value)}>
                  <SelectTrigger><SelectValue placeholder="Select epoch" /></SelectTrigger>
                  <SelectContent>
                    {knowledgeEpochs.map((epoch) => (
                      <SelectItem key={epoch.id} value={epoch.id}>{epoch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Arm</Label>
                <Select value={values.armId ?? ''} onValueChange={(value) => updateField('armId', value)}>
                  <SelectTrigger><SelectValue placeholder="Select arm" /></SelectTrigger>
                  <SelectContent>
                    {knowledgeArms.map((arm) => (
                      <SelectItem key={arm.id} value={arm.id}>{arm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-planned-duration">Planned duration</Label>
                <Input id="soa-entity-planned-duration" value={values.plannedDuration ?? ''} onChange={(event) => updateField('plannedDuration', event.target.value)} />
              </div>
            </>
          )}

          {entityKind === 'activity' && (
            <div className="space-y-2">
              <Label>Linked visit</Label>
              <Select value={values.visitId ?? ''} onValueChange={(value) => updateField('visitId', value)}>
                <SelectTrigger><SelectValue placeholder="Select visit" /></SelectTrigger>
                <SelectContent>
                  {knowledgeVisits.map((visit) => (
                    <SelectItem key={visit.id} value={visit.id}>{visit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entityKind === 'milestone' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-milestone-type">Milestone type</Label>
                <Input id="soa-entity-milestone-type" value={values.milestoneType ?? ''} onChange={(event) => updateField('milestoneType', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-anchor-event">Anchor date/event</Label>
                <Input id="soa-entity-anchor-event" value={values.anchorDateOrEvent ?? ''} onChange={(event) => updateField('anchorDateOrEvent', event.target.value)} />
              </div>
            </>
          )}

          {entityKind === 'visit' && (
            <>
              <div className="space-y-2">
                <Label>Epoch</Label>
                <Select value={values.epochId ?? ''} onValueChange={(value) => updateField('epochId', value)}>
                  <SelectTrigger data-testid="soa-entity-visit-epoch"><SelectValue placeholder="Select epoch" /></SelectTrigger>
                  <SelectContent>
                    {knowledgeEpochs.map((epoch) => (
                      <SelectItem key={epoch.id} value={epoch.id}>{epoch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visit type</Label>
                <Select value={values.visitType ?? 'treatment'} onValueChange={(value) => updateField('visitType', value)}>
                  <SelectTrigger data-testid="soa-entity-visit-type">
                    <SelectValue placeholder="Select visit type" />
                  </SelectTrigger>
                  <SelectContent>
                    {['screening', 'baseline', 'treatment', 'follow-up', 'early-termination', 'unscheduled'].map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Anchor</Label>
                <Select value={values.anchorId ?? ''} onValueChange={(value) => updateField('anchorId', value)}>
                  <SelectTrigger data-testid="soa-entity-visit-anchor">
                    <SelectValue placeholder="Select anchor" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...anchors, ...knowledgeMilestones.map((m) => ({ id: m.id, name: m.name }))].map((anchor) => (
                      <SelectItem key={anchor.id} value={anchor.id}>
                        {anchor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="soa-entity-offset">Offset</Label>
                  <Input id="soa-entity-offset" value={values.offset ?? ''} onChange={(event) => updateField('offset', event.target.value)} placeholder="+14 days" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soa-entity-window">Window</Label>
                  <Input id="soa-entity-window" value={values.window ?? ''} onChange={(event) => updateField('window', event.target.value)} placeholder="±3 days" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="soa-entity-nominal-day">Nominal day</Label>
                  <Input id="soa-entity-nominal-day" type="number" value={values.nominalDay ?? ''} onChange={(event) => updateField('nominalDay', Number.parseInt(event.target.value, 10) || undefined)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soa-entity-nominal-week">Nominal week</Label>
                  <Input id="soa-entity-nominal-week" type="number" value={values.nominalWeek ?? ''} onChange={(event) => updateField('nominalWeek', Number.parseInt(event.target.value, 10) || undefined)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="soa-entity-required"
                  checked={values.required ?? true}
                  onCheckedChange={(checked) => updateField('required', checked === true)}
                />
                <Label htmlFor="soa-entity-required">Required visit</Label>
              </div>
            </>
          )}

          {entityKind === 'assessment' && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={values.category ?? 'other'} onValueChange={(value) => updateField('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {['safety', 'efficacy', 'pk', 'pro', 'imaging', 'laboratory', 'vitalSigns', 'physicalExam', 'adverseEvents', 'other'].map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entityKind === 'condition' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-condition-text">Condition text</Label>
                <Textarea id="soa-entity-condition-text" value={values.conditionText ?? ''} onChange={(event) => updateField('conditionText', event.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-trigger-logic">Trigger logic</Label>
                <Input id="soa-entity-trigger-logic" value={values.triggerLogic ?? ''} onChange={(event) => updateField('triggerLogic', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-applies-to-id">Applies to entity id</Label>
                <Input id="soa-entity-applies-to-id" value={values.appliesToEntityId ?? ''} onChange={(event) => updateField('appliesToEntityId', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-applies-to-kind">Applies to kind</Label>
                <Input id="soa-entity-applies-to-kind" value={values.appliesToEntityKind ?? ''} onChange={(event) => updateField('appliesToEntityKind', event.target.value)} placeholder="visit | activity | assessment | scheduleRule" />
              </div>
            </>
          )}

          {entityKind === 'scheduleRule' && (
            <>
              <div className="space-y-2">
                <Label>Assessment</Label>
                <Select value={values.assessmentId ?? ''} onValueChange={(value) => updateField('assessmentId', value)}>
                  <SelectTrigger data-testid="soa-entity-rule-assessment">
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visit</Label>
                <Select value={values.visitDefinitionId ?? ''} onValueChange={(value) => updateField('visitDefinitionId', value)}>
                  <SelectTrigger data-testid="soa-entity-rule-visit">
                    <SelectValue placeholder="Select visit" />
                  </SelectTrigger>
                  <SelectContent>
                    {visits.map((visit) => (
                      <SelectItem key={visit.id} value={visit.id}>
                        {visit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="soa-entity-footnote">Footnote</Label>
                <Input id="soa-entity-footnote" value={values.footnote ?? ''} onChange={(event) => updateField('footnote', event.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="soa-entity-rule-required"
                  checked={values.required ?? true}
                  onCheckedChange={(checked) => updateField('required', checked === true)}
                />
                <Label htmlFor="soa-entity-rule-required">Required at visit</Label>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="soa-entity-notes">Notes</Label>
            <Textarea id="soa-entity-notes" value={values.notes ?? ''} onChange={(event) => updateField('notes', event.target.value)} rows={2} />
          </div>

          {warnings.map((issue) => (
            <Alert key={`${issue.field}-${issue.message}`}>
              <AlertDescription className="text-amber-700 dark:text-amber-300">{issue.message}</AlertDescription>
            </Alert>
          ))}
          {errors.map((issue) => (
            <Alert key={`${issue.field}-${issue.message}`} variant="destructive">
              <AlertDescription>{issue.message}</AlertDescription>
            </Alert>
          ))}
          {saveError ? (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={handleSave} data-testid="soa-entity-save-button">
            {saving ? 'Saving…' : mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
