import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Sparkles } from 'lucide-react';
import type { FieldDefinition } from '../../types/protocol';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import {
  isTitlePageFieldValueComplete,
  orderedTitlePageFieldDefinitions,
  resolveTitlePageFieldDisplayBadges,
  titlePageFieldBadgeClass,
} from '../../domain/protocol/authoring/titlePageAuthoring';
import {
  isTitlePageFieldVisible,
  readTitlePageFieldValues,
  TITLE_PAGE_FIELD_CATALOG,
  TITLE_PAGE_FIELD_SPECS_BY_ID,
} from '../../domain/protocol/authoring/titlePageModel';
import {
  resolveTitlePagePlaceholder,
  resolveTitlePageSelectPlaceholder,
} from '../../domain/protocol/authoring/titlePagePlaceholders';

export interface TitlePageViewportProps {
  fields: FieldDefinition[];
  mode: 'viewing' | 'editing';
  readOnly?: boolean;
  onFieldChange: (fieldId: string, value: unknown) => void;
  onFieldFocus?: (fieldId: string) => void;
  onFieldBlur?: () => void;
}

function asRepeatableValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? ''));
  }
  if (value === undefined || value === null || value === '') {
    return [''];
  }
  return [String(value)];
}

export function TitlePageViewport({
  fields,
  mode,
  readOnly = false,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
}: TitlePageViewportProps) {
  const orderedFields = useMemo(() => orderedTitlePageFieldDefinitions(fields), [fields]);
  const values = useMemo(() => readTitlePageFieldValues(orderedFields), [orderedFields]);
  const [collapsedOptional, setCollapsedOptional] = useState<Record<string, boolean>>({});

  const visibleFields = orderedFields.filter((field) => {
    const spec = TITLE_PAGE_FIELD_SPECS_BY_ID[field.id as keyof typeof TITLE_PAGE_FIELD_SPECS_BY_ID];
    return spec ? isTitlePageFieldVisible(spec, values) : true;
  });

  return (
    <div className="space-y-4" data-testid="title-page-viewport">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-sm font-medium">ICH M11 Title Page</p>
        <p className="text-xs text-muted-foreground mt-1">
          Elements render in canonical M11 sequence. Presentation badges indicate conformance; fields are not grouped by requirement status.
        </p>
      </div>

      {visibleFields.map((field) => {
        const spec = TITLE_PAGE_FIELD_SPECS_BY_ID[field.id as keyof typeof TITLE_PAGE_FIELD_SPECS_BY_ID];
        const hasValue = isTitlePageFieldValueComplete(field.id, field.value);
        const isOptionalEmpty =
          mode === 'viewing' &&
          field.requiredness === 'optional' &&
          !hasValue;
        const collapsed = isOptionalEmpty && (collapsedOptional[field.id] ?? true);

        if (isOptionalEmpty && collapsed) {
          return (
            <button
              key={field.id}
              type="button"
              className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-left text-sm text-muted-foreground hover:bg-muted/30"
              data-testid={`title-page-collapsed-${field.id}`}
              onClick={() => setCollapsedOptional((prev) => ({ ...prev, [field.id]: false }))}
            >
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span>{field.label}</span>
              <Badge variant="outline" className="ml-auto text-xs text-muted-foreground border-border">
                Optional · empty
              </Badge>
            </button>
          );
        }

        return (
          <TitlePageFieldBlock
            key={field.id}
            field={field}
            specHelp={spec?.helpText}
            readOnly={readOnly || mode === 'viewing'}
            onFieldChange={onFieldChange}
            onFieldFocus={onFieldFocus}
            onFieldBlur={onFieldBlur}
            onCollapse={
              isOptionalEmpty
                ? () => setCollapsedOptional((prev) => ({ ...prev, [field.id]: true }))
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

function TitlePageFieldBlock({
  field,
  specHelp,
  readOnly,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
  onCollapse,
}: {
  field: FieldDefinition;
  specHelp?: string;
  readOnly: boolean;
  onFieldChange: (fieldId: string, value: unknown) => void;
  onFieldFocus?: (fieldId: string) => void;
  onFieldBlur?: () => void;
  onCollapse?: () => void;
}) {
  const badges = resolveTitlePageFieldDisplayBadges(field);
  const isControlledSelect = Boolean(field.controlledTerminology);
  const isFullTitle = field.id === 'title_page.full_title';
  const isRepeatable = Boolean(field.repeatable || TITLE_PAGE_FIELD_SPECS_BY_ID[field.id as keyof typeof TITLE_PAGE_FIELD_SPECS_BY_ID]?.repeatable);
  const entries = asRepeatableValues(field.value);

  const updateRepeatableEntry = (index: number, nextValue: string) => {
    const next = [...entries];
    next[index] = nextValue;
    onFieldChange(field.id, next.filter((entry, idx) => entry.trim() || idx < next.length - 1));
  };

  const addRepeatableEntry = () => {
    onFieldChange(field.id, [...entries.filter(Boolean), '']);
  };

  return (
    <div
      className="space-y-2 p-4 rounded-lg border border-border bg-card/50"
      data-testid={`field-editor-${field.id}`}
      data-title-page-sequence={
        TITLE_PAGE_FIELD_CATALOG.find((spec) => spec.id === field.id)?.sequence
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {onCollapse ? (
              <button type="button" onClick={onCollapse} className="text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-4 w-4" />
              </button>
            ) : null}
            <Label htmlFor={field.id} className="text-sm font-medium">
              {field.label}
            </Label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {badges.map((badge) => (
              <Badge key={badge} variant="outline" className={`text-xs ${titlePageFieldBadgeClass(badge)}`}>
                {badge}
              </Badge>
            ))}
          </div>
          {(specHelp || field.aiHints?.[0]) && (
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              <Sparkles className="h-3 w-3 inline mr-1" />
              {specHelp ?? field.aiHints?.[0]}
            </p>
          )}
        </div>
      </div>

      {isRepeatable ? (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <Input
              key={`${field.id}-${index}`}
              type="text"
              value={entry}
              readOnly={readOnly}
              onChange={(event) => updateRepeatableEntry(index, event.target.value)}
              onFocus={() => onFieldFocus?.(field.id)}
              onBlur={() => onFieldBlur?.()}
              placeholder={resolveTitlePagePlaceholder(field.id, field.label)}
              className="bg-card text-foreground dark:bg-input/30"
              data-testid={`field-input-${field.id}-${index}`}
            />
          ))}
          {!readOnly ? (
            <Button type="button" size="sm" variant="outline" onClick={addRepeatableEntry} data-testid={`field-add-${field.id}`}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Another
            </Button>
          ) : null}
        </div>
      ) : isControlledSelect ? (
        <Select
          value={field.value ? String(field.value) : undefined}
          disabled={readOnly}
          onValueChange={(value) => onFieldChange(field.id, value)}
        >
          <SelectTrigger className="bg-card text-foreground dark:bg-input/30" data-testid={`field-select-${field.id}`}>
            <SelectValue placeholder={resolveTitlePageSelectPlaceholder(field.id, field.label)} />
          </SelectTrigger>
          <SelectContent>
            {field.controlledTerminology!.values.map((value, index) => {
              const label = typeof value === 'string' ? value : value.label;
              return (
                <SelectItem key={`${field.id}-${index}`} value={label}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : isFullTitle ? (
        <Textarea
          value={field.value ? String(field.value) : ''}
          readOnly={readOnly}
          onChange={(event) => onFieldChange(field.id, event.target.value)}
          onFocus={() => onFieldFocus?.(field.id)}
          onBlur={() => onFieldBlur?.()}
          placeholder={resolveTitlePagePlaceholder(field.id, field.label)}
          className="min-h-[120px] bg-card text-foreground dark:bg-input/30"
          data-testid={`field-input-${field.id}`}
        />
      ) : (
        <Input
          type="text"
          value={field.value ? String(field.value) : ''}
          readOnly={readOnly}
          onChange={(event) => onFieldChange(field.id, event.target.value)}
          onFocus={() => onFieldFocus?.(field.id)}
          onBlur={() => onFieldBlur?.()}
          placeholder={resolveTitlePagePlaceholder(field.id, field.label)}
          className="bg-card text-foreground dark:bg-input/30"
          data-testid={`field-input-${field.id}`}
        />
      )}
    </div>
  );
}
