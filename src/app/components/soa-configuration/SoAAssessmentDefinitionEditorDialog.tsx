import { useEffect, useMemo, useState } from 'react';

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
import type { ProtocolDocument, SoAAssessmentDefinition } from '../../domain/protocol/types';
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
import { getAssessmentCategoryOptions } from './assessmentCategoryOptions';
import { generateNextAssessmentCatalogId } from './generateAssessmentCatalogId';

export type SoAAssessmentDefinitionEditorMode = 'create' | 'edit';

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
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => getAssessmentCategoryOptions(document), [document]);
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
      setLabel(definition.label);
      setCategory(definition.category);
      return;
    }

    setLabel('');
    setCategory(categoryOptions[0] ?? 'Safety');
  }, [open, mode, definition, categoryOptions]);

  function handleSave() {
    setSaveError(null);

    if (mode === 'create') {
      const generatedId = generateNextAssessmentCatalogId(document.soaAssessmentDefinitions ?? []);
      const input: CreateSoAAssessmentDefinitionInput = {
        id: generatedId,
        label: label.trim(),
        category: category.trim(),
        order: defaultOrder,
      };

      const failure = getCreateSoAAssessmentDefinitionFailure(document, input);
      if (failure) {
        setSaveError(describeSoAAssessmentDefinitionMutationFailure(failure));
        return;
      }

      if (!createSoAAssessmentDefinition(input)) {
        setSaveError('Could not create assessment.');
        return;
      }

      onSuccess(generatedId);
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
    };

    const failure = getUpdateSoAAssessmentDefinitionFailure(document, patch);
    if (failure) {
      setSaveError(describeSoAAssessmentDefinitionMutationFailure(failure));
      return;
    }

    if (!updateSoAAssessmentDefinition(definition.id, patch)) {
      setSaveError('Could not update assessment.');
      return;
    }

    onSuccess(definition.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create assessment' : 'Edit assessment'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add an assessment to the catalog. Schedule cells remain generated from rules.'
              : 'Update the assessment label and category.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {saveError ? (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-label">Assessment name</Label>
            <Input
              id="soa-assessment-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Assessment name"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="soa-assessment-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="soa-assessment-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
