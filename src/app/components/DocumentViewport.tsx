import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Sparkles, Link2, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { ProtocolSection, FieldDefinition } from '../types/protocol';
import { getStatusColor, getStatusLabel } from '../utils/statusColors';

interface DocumentViewportProps {
  section: ProtocolSection | null;
  fields: FieldDefinition[];
  onFieldChange: (fieldId: string, value: any) => void;
}

export function DocumentViewport({ section, fields, onFieldChange }: DocumentViewportProps) {
  if (!section) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-muted-foreground">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a section from the Protocol Explorer to begin editing</p>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(section.status);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Breadcrumb and Status Bar */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{section.title}</h2>
            <Badge variant="outline" className={`${statusColor.text} ${statusColor.border}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} mr-1.5`} />
              {getStatusLabel(section.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Conformance: {section.conformance}
            </Badge>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl">
          {fields.length > 0 ? (
            <div className="space-y-6">
              {fields.map((field) => (
                <FieldEditor key={field.id} field={field} onFieldChange={onFieldChange} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No editable fields in this section. Select a different section to edit.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FieldEditor({ field, onFieldChange }: { field: FieldDefinition; onFieldChange: (fieldId: string, value: any) => void }) {
  const renderFieldBadges = () => (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {field.requiredness === 'required' && (
        <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400 border-red-500/30">
          Required
        </Badge>
      )}
      {field.requiredness === 'conditional' && (
        <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/30">
          Conditional
        </Badge>
      )}
      {field.repeatable && (
        <Badge variant="outline" className="text-xs">
          <RefreshCw className="h-2.5 w-2.5 mr-1" />
          Repeatable
        </Badge>
      )}
      {field.reusable && (
        <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-400 border-purple-500/30">
          <Link2 className="h-2.5 w-2.5 mr-1" />
          Reused
        </Badge>
      )}
      {field.controlledTerminology && (
        <Badge variant="outline" className="text-xs">
          Controlled Terminology
        </Badge>
      )}
      {field.aiHints && field.aiHints.length > 0 && (
        <Badge variant="outline" className="text-xs text-violet-600 dark:text-violet-400 border-violet-500/30">
          <Sparkles className="h-2.5 w-2.5 mr-1" />
          AI Hint Available
        </Badge>
      )}
    </div>
  );

  const renderField = () => {
    if (field.controlledTerminology) {
      return (
        <Select value={field.value || ''} onValueChange={(value) => onFieldChange(field.id, value)}>
          <SelectTrigger className="bg-input-background">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.controlledTerminology.values.map((value, index) => {
              const label = typeof value === 'string' ? value : value.label;
              return (
                <SelectItem key={index} value={label}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }

    if (field.dataType === 'rich_text' || field.kind === 'data') {
      return (
        <Textarea
          value={field.value || ''}
          onChange={(e) => onFieldChange(field.id, e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          className="min-h-[100px] bg-input-background"
        />
      );
    }

    return (
      <Input
        type="text"
        value={field.value || ''}
        onChange={(e) => onFieldChange(field.id, e.target.value)}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        className="bg-input-background"
      />
    );
  };

  return (
    <div className="space-y-2 p-4 rounded-lg border border-border bg-card/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Label htmlFor={field.id} className="text-sm font-medium">
            {field.label}
          </Label>
          {renderFieldBadges()}
          {field.aiHints && field.aiHints.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              <Sparkles className="h-3 w-3 inline mr-1" />
              {field.aiHints[0]}
            </p>
          )}
        </div>
        {field.value && (
          <CheckCircle2 className="h-4 w-4 text-green-500 ml-2" />
        )}
      </div>
      <div id={field.id}>{renderField()}</div>
    </div>
  );
}

function FileText({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
