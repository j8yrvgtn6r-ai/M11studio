import { useEffect, useMemo, useState } from 'react';

import type { ProtocolDocument, SoAAssessmentDefinition } from '../../domain/protocol/types';
import {
  createSoAAssessmentDefinition,
  describeSoAAssessmentDefinitionMutationFailure,
  getCreateSoAAssessmentDefinitionFailure,
  getUpdateSoAAssessmentDefinitionFailure,
  updateSoAAssessmentDefinition,
} from '../../domain/protocol';
import type {
  CreateSoAAssessmentDefinitionInput,
  UpdateSoAAssessmentDefinitionPatch,
} from '../../domain/protocol';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
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

export type SoAAssessmentDefinitionEditorMode = 'create' | 'edit';

const NONE_VALUE = '__none__';

interface SectionOption {
  id: string;
  label: string;
}

function flattenSectionOptions(sections: ProtocolDocument['sections'], depth = 0): SectionOption[] {
  const options: SectionOption[] = [];

  for (const section of sections ?? []) {
    const prefix = depth > 0 ? `${'  '.repeat(depth)}` : '';
    options.push({ id: section.id, label: `${prefix}${section.id} — ${section.title}` });
    if (section.children?.length) {
      options.push(...flattenSectionOptions(section.children, depth + 1));
    }
  }

  return options;
}

interface SoAAssessmentDefinitionEditorDialogProps {
  open: boolean;
  mode: SoAAssessmentDefinitionEditorMode;
  definition: SoAAssessmentDefinition | null;
  document: ProtocolDocument;
  onOpenChange: (open: boolean) => void;
  onSuccess: (definitionId: string) => void;
}

export function SoAAssessmentDefinitionEditorDialog({
  open,
  mode,
  definition,
  document,
  onOpenChange,
  onSuccess,
}: SoAAssessmentDefinitionEditorDialogProps) {
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [order, setOrder] = useState('');
  const [linkedSectionId, setLinkedSectionId] = useState(NONE_VALUE);
  const [clinicalDesignAssessmentId, setClinicalDesignAssessmentId] = useState(NONE_VALUE);
  const [metadataText, setMetadataText] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const sectionOptions = useMemo(() => flattenSectionOptions(document.sections), [document.sections]);
  const clinicalDesignAssessments = document.clinicalDesign.assessments ?? [];
  const defaultOrder = useMemo(() => {
    const definitions = document.soaAssessmentDefinitions ?? [];
    if (definitions.length === 0) {
      return 1;
    }
    return Math.max(...definitions.map((item) => item.order)) + 1;
  }, [document.soaAssessmentDefinitions]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSaveError(null);

    if (mode === 'edit' && definition) {
      setId(definition.id);
      setLabel(definition.label);
      setCategory(definition.category);
      setOrder(String(definition.order));
      setLinkedSectionId(definition.linkedSectionId ?? NONE_VALUE);
      setClinicalDesignAssessmentId(definition.clinicalDesignAssessmentId ?? NONE_VALUE);
      setMetadataText(
        definition.metadata && Object.keys(definition.metadata).length > 0
          ? JSON.stringify(definition.metadata, null, 2)
          : '',
      );
      return;
    }

    setId('');
    setLabel('');
    setCategory('');
    setOrder(String(defaultOrder));
    setLinkedSectionId(NONE_VALUE);
    setClinicalDesignAssessmentId(NONE_VALUE);
    setMetadataText('');
  }, [open, mode, definition, defaultOrder]);

  function parseMetadata(): Record<string, unknown> | undefined | 'invalid' {
    const trimmed = metadataText.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return 'invalid';
      }
      return parsed as Record<string, unknown>;
    } catch {
      return 'invalid';
    }
  }

  function handleSave() {
    setSaveError(null);

    const parsedMetadata = parseMetadata();
    if (parsedMetadata === 'invalid') {
      setSaveError('Metadata must be valid JSON object.');
      return;
    }

    const parsedOrder = Number(order);
    const linkedSection =
      linkedSectionId === NONE_VALUE || linkedSectionId === '' ? undefined : linkedSectionId;
    const clinicalDesignAssessment =
      clinicalDesignAssessmentId === NONE_VALUE || clinicalDesignAssessmentId === ''
        ? undefined
        : clinicalDesignAssessmentId;

    if (mode === 'create') {
      const input: CreateSoAAssessmentDefinitionInput = {
        id: id.trim(),
        label: label.trim(),
        category: category.trim(),
        order: parsedOrder,
        linkedSectionId: linkedSection,
        clinicalDesignAssessmentId: clinicalDesignAssessment,
        metadata: parsedMetadata,
      };

      const failure = getCreateSoAAssessmentDefinitionFailure(document, input);
      if (failure) {
        setSaveError(describeSoAAssessmentDefinitionMutationFailure(failure));
        return;
      }

      if (!createSoAAssessmentDefinition(input)) {
        setSaveError('Could not create SoA assessment definition.');
        return;
      }

      onSuccess(input.id);
      onOpenChange(false);
      return;
    }

    if (!definition) {
      setSaveError('No assessment selected for editing.');
      return;
    }

    const patch: UpdateSoAAssessmentDefinitionPatch = {
      label: label.trim(),
      category: category.trim(),
      order: parsedOrder,
      linkedSectionId: linkedSection ?? '',
      clinicalDesignAssessmentId: clinicalDesignAssessment ?? '',
      metadata: parsedMetadata,
    };

    const failure = getUpdateSoAAssessmentDefinitionFailure(document, patch);
    if (failure) {
      setSaveError(describeSoAAssessmentDefinitionMutationFailure(failure));
      return;
    }

    if (!updateSoAAssessmentDefinition(definition.id, patch)) {
      setSaveError('Could not update SoA assessment definition.');
      return;
    }

    onSuccess(definition.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create assessment' : 'Edit assessment'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a row to the SoA assessment catalog. Schedule cells remain generated from rules.'
              : 'Update catalog metadata. Assessment id cannot be changed after creation.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {saveError ? (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-id">Id</Label>
            <Input
              id="soa-assessment-id"
              value={id}
              onChange={(event) => setId(event.target.value)}
              disabled={mode === 'edit'}
              placeholder="e.g. a13"
              className="font-mono"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-label">Label</Label>
            <Input
              id="soa-assessment-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Assessment label"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-category">Category</Label>
            <Input
              id="soa-assessment-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="e.g. Safety"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-order">Order</Label>
            <Input
              id="soa-assessment-order"
              type="number"
              value={order}
              onChange={(event) => setOrder(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-linked-section">Linked section (optional)</Label>
            <Select value={linkedSectionId} onValueChange={setLinkedSectionId}>
              <SelectTrigger id="soa-assessment-linked-section">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {sectionOptions.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-clinical-design">Clinical design assessment (optional)</Label>
            <Select value={clinicalDesignAssessmentId} onValueChange={setClinicalDesignAssessmentId}>
              <SelectTrigger id="soa-assessment-clinical-design">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {clinicalDesignAssessments.map((assessment) => (
                  <SelectItem key={assessment.id} value={assessment.id}>
                    {assessment.id} — {assessment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-metadata">Metadata (optional JSON)</Label>
            <Textarea
              id="soa-assessment-metadata"
              value={metadataText}
              onChange={(event) => setMetadataText(event.target.value)}
              placeholder='{"key": "value"}'
              className="font-mono text-xs min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{mode === 'create' ? 'Create' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
