import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertCircle, Info, AlertTriangle, MessageSquare, Clock, Database, Link2, CheckCircle2 } from 'lucide-react';
import type { FieldDefinition, ValidationIssue, AuditEvent, Comment } from '../types/protocol';
import { getSeverityColor } from '../utils/statusColors';
import { format } from 'date-fns';
import { SoAAssessmentMetadataPanel } from './soa-configuration/SoAAssessmentMetadataPanel';

interface DetailInspectorProps {
  selectedField: FieldDefinition | null;
  selectedSectionId: string | null;
  validationIssues: ValidationIssue[];
  auditEvents: AuditEvent[];
  comments: Comment[];
  isScheduleOfActivitiesView?: boolean;
}

export function DetailInspector({
  selectedField,
  selectedSectionId,
  validationIssues,
  auditEvents,
  comments,
  isScheduleOfActivitiesView = false,
}: DetailInspectorProps) {
  const sectionValidationIssues = validationIssues.filter((issue) => issue.sectionId === selectedSectionId);
  const sectionAuditEvents = auditEvents.filter(
    (event) => !event.sectionId || event.sectionId === selectedSectionId
  );
  const sectionComments = comments.filter((comment) => comment.sectionId === selectedSectionId);

  return (
    <div className="flex flex-col h-full bg-card border-t border-border">
      <Tabs defaultValue="metadata" className="flex-1 flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <TabsList className="h-8 w-full justify-start">
            <TabsTrigger value="metadata" className="text-xs">
              Metadata
            </TabsTrigger>
            <TabsTrigger value="validation" className="text-xs">
              Validation
              {sectionValidationIssues.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">
                  {sectionValidationIssues.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs">
              Comments
              {sectionComments.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {sectionComments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">
              Audit Trail
            </TabsTrigger>
            <TabsTrigger value="mappings" className="text-xs">
              Mappings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="metadata" className="p-3 mt-0">
            {isScheduleOfActivitiesView ? (
              <SoAAssessmentMetadataPanel />
            ) : (
              <MetadataTab field={selectedField} />
            )}
          </TabsContent>

          <TabsContent value="validation" className="p-3 mt-0">
            <ValidationTab issues={sectionValidationIssues} />
          </TabsContent>

          <TabsContent value="comments" className="p-3 mt-0">
            <CommentsTab comments={sectionComments} />
          </TabsContent>

          <TabsContent value="audit" className="p-3 mt-0">
            <AuditTab events={sectionAuditEvents} />
          </TabsContent>

          <TabsContent value="mappings" className="p-3 mt-0">
            <MappingsTab field={selectedField} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function MetadataTab({ field }: { field: FieldDefinition | null }) {
  if (!field) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Select a field to view metadata</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Field Label</h4>
        <p className="text-sm">{field.label}</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Field ID</h4>
        <code className="text-xs bg-muted px-2 py-1 rounded">{field.id}</code>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Kind</h4>
          <Badge variant="outline" className="text-xs">
            {field.kind}
          </Badge>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Data Type</h4>
          <Badge variant="outline" className="text-xs">
            {field.dataType}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Requiredness</h4>
          <Badge
            variant="outline"
            className={`text-xs ${
              field.requiredness === 'required'
                ? 'text-red-600 dark:text-red-400'
                : field.requiredness === 'conditional'
                  ? 'text-amber-600 dark:text-amber-400'
                  : ''
            }`}
          >
            {field.requiredness}
          </Badge>
        </div>
        {field.cardinality && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1">Cardinality</h4>
            <Badge variant="outline" className="text-xs">
              {field.cardinality}
            </Badge>
          </div>
        )}
      </div>

      {field.controlledTerminology && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Controlled Terminology</h4>
          <div className="space-y-1">
            <p className="text-xs">
              Code List: <code className="bg-muted px-1.5 py-0.5 rounded">{field.controlledTerminology.codeList}</code>
            </p>
            <div className="text-xs">
              <span className="text-muted-foreground">Values:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {field.controlledTerminology.values.slice(0, 5).map((value, index) => {
                  const label = typeof value === 'string' ? value : value.label;
                  return (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  );
                })}
                {field.controlledTerminology.values.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{field.controlledTerminology.values.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {field.validationRules && field.validationRules.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Validation Rules</h4>
          <ul className="space-y-1">
            {field.validationRules.map((rule, index) => (
              <li key={index} className="text-xs flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{rule.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {field.aiHints && field.aiHints.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">AI Hints</h4>
          <ul className="space-y-1">
            {field.aiHints.map((hint, index) => (
              <li key={index} className="text-xs text-violet-600 dark:text-violet-400 italic">
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ValidationTab({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
        <p>No validation issues</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => {
        const severityColor = getSeverityColor(issue.severity);
        const SeverityIcon = issue.severity === 'error' ? AlertCircle : issue.severity === 'warning' ? AlertTriangle : Info;

        return (
          <div key={issue.id} className={`p-3 rounded-lg border ${severityColor.border} ${severityColor.bg}`}>
            <div className="flex items-start gap-2">
              <SeverityIcon className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor.icon}`} />
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium ${severityColor.text}`}>{issue.name}</h4>
                <p className="text-xs mt-1">{issue.message}</p>
                {issue.quickFix && (
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                    Quick Fix: {issue.quickFix}
                  </Button>
                )}
              </div>
              <Badge variant="outline" className={`text-[10px] ${severityColor.text}`}>
                {issue.severity}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommentsTab({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No comments yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium">{comment.user}</p>
              <p className="text-xs text-muted-foreground">{format(comment.timestamp, 'MMM d, yyyy h:mm a')}</p>
            </div>
            {!comment.resolved && (
              <Badge variant="secondary" className="text-xs">
                Open
              </Badge>
            )}
          </div>
          <p className="text-sm">{comment.content}</p>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ events }: { events: AuditEvent[] }) {
  return (
    <div className="space-y-2">
      {events.slice(0, 10).map((event) => (
        <div key={event.id} className="flex items-start gap-2 text-xs pb-2 border-b border-border last:border-0">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{event.action}</p>
            <p className="text-muted-foreground">{event.details}</p>
            <p className="text-muted-foreground mt-0.5">
              {event.user} • {format(event.timestamp, 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MappingsTab({ field }: { field: FieldDefinition | null }) {
  if (!field) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Select a field to view downstream mappings</p>
      </div>
    );
  }

  const mockMappings = [
    { system: 'CDASH', domain: 'Demographics', variable: 'AGE', status: 'Mapped' },
    { system: 'SDTM', domain: 'DM', variable: 'AGE', status: 'Mapped' },
    { system: 'FHIR', resource: 'Patient', element: 'birthDate', status: 'Proposed' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">Downstream Data Mappings</h4>
        <div className="space-y-2">
          {mockMappings.map((mapping, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded border border-border bg-card/50">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  {mapping.system} → {mapping.domain || mapping.resource}
                </p>
                <p className="text-xs text-muted-foreground">{mapping.variable || mapping.element}</p>
              </div>
              <Badge
                variant={mapping.status === 'Mapped' ? 'default' : 'secondary'}
                className="text-[10px] shrink-0"
              >
                {mapping.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
