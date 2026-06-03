import { useEffect, useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Network,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  ExternalLink,
  TrendingUp,
  Pencil,
  X,
  Save,
  Trash2,
  Plus,
} from 'lucide-react';
import type { DependencyEdge, DependencyNode, NodeStatus } from '../types/dependencyGraph';
import type { RelationshipKind } from '../domain/protocol';
import {
  createRelationship,
  deleteRelationship,
  findRelationship,
  getDependencyEdges,
  getDependencyNodes,
  updateDesignEntity,
  updateRelationship,
} from '../domain/protocol';

const STATUS_OPTIONS: NodeStatus[] = [
  'complete',
  'incomplete',
  'validation-issue',
  'ai-recommendation',
  'recently-modified',
];

const RELATIONSHIP_KIND_OPTIONS: RelationshipKind[] = [
  'defines',
  'measured-by',
  'performed-at',
  'analyzed-by',
  'requires',
  'assigned-to',
  'predicts',
  'monitored-at',
];

interface EntityDraft {
  name: string;
  description: string;
  sectionRef: string;
  status: NodeStatus[];
}

interface RelationshipDraft {
  label: string;
  kind: string;
  sourceId: string;
  targetId: string;
}

type RelationshipDirection = 'outgoing' | 'incoming';

interface CreateRelationshipDraft {
  direction: RelationshipDirection;
  otherEntityId: string;
  label: string;
  kind: string;
}

interface ConnectedRelationship {
  edge: DependencyEdge;
  connectedNode: DependencyNode;
  kind?: string;
}

interface DependencyInspectorProps {
  selectedNode: DependencyNode | null;
}

function toEntityDraft(node: DependencyNode): EntityDraft {
  return {
    name: node.name,
    description: node.description ?? '',
    sectionRef: node.sectionId ?? '',
    status: [...node.status],
  };
}

function toRelationshipDraft(relationshipId: string): RelationshipDraft | null {
  const location = findRelationship(relationshipId);
  if (!location) {
    return null;
  }

  return {
    label: location.relationship.label ?? '',
    kind: location.relationship.kind ?? '',
    sourceId: location.relationship.sourceId,
    targetId: location.relationship.targetId,
  };
}

function formatEntityOptionLabel(entity: DependencyNode): string {
  return `${entity.name} · ${entity.type.replace('-', ' ')} · ${entity.id}`;
}

function formatMissingEntityOptionLabel(entityId: string): string {
  return `Missing entity · unknown · ${entityId}`;
}

function generateRelationshipId(): string {
  return `rel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function resolveRelationshipEndpoints(
  selectedNodeId: string,
  direction: RelationshipDirection,
  otherEntityId: string
): { sourceId: string; targetId: string } {
  if (direction === 'outgoing') {
    return { sourceId: selectedNodeId, targetId: otherEntityId };
  }

  return { sourceId: otherEntityId, targetId: selectedNodeId };
}

interface EntityEndpointSelectProps {
  label: string;
  value: string;
  entities: DependencyNode[];
  onChange: (entityId: string) => void;
}

function EntityEndpointSelect({ label, value, entities, onChange }: EntityEndpointSelectProps) {
  const hasCurrentValue = entities.some((entity) => entity.id === value);

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px]">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Select entity" />
        </SelectTrigger>
        <SelectContent>
          {!hasCurrentValue && value && (
            <SelectItem value={value} className="text-red-600 dark:text-red-400">
              {formatMissingEntityOptionLabel(value)}
            </SelectItem>
          )}
          {entities.map((entity) => (
            <SelectItem key={entity.id} value={entity.id}>
              {formatEntityOptionLabel(entity)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface CreateRelationshipPanelProps {
  selectedNode: DependencyNode;
  designEntities: DependencyNode[];
  createDraft: CreateRelationshipDraft;
  createError: string | null;
  onDraftChange: (draft: CreateRelationshipDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}

function CreateRelationshipPanel({
  selectedNode,
  designEntities,
  createDraft,
  createError,
  onDraftChange,
  onCancel,
  onSave,
}: CreateRelationshipPanelProps) {
  const otherEntityOptions = designEntities.filter((entity) => entity.id !== selectedNode.id);

  return (
    <div className="p-3 rounded-md border border-border bg-card/50 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">New relationship</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" className="h-6 text-[10px] px-2" onClick={onSave}>
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px]">Direction</Label>
        <Select
          value={createDraft.direction}
          onValueChange={(value) =>
            onDraftChange({
              ...createDraft,
              direction: value as RelationshipDirection,
            })
          }
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outgoing">
              {selectedNode.name} as source
            </SelectItem>
            <SelectItem value="incoming">
              {selectedNode.name} as target
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <EntityEndpointSelect
        label="Other entity"
        value={createDraft.otherEntityId}
        entities={otherEntityOptions}
        onChange={(otherEntityId) => onDraftChange({ ...createDraft, otherEntityId })}
      />

      <div className="space-y-1.5">
        <Label className="text-[10px]">Label</Label>
        <Input
          value={createDraft.label}
          onChange={(event) => onDraftChange({ ...createDraft, label: event.target.value })}
          className="h-7 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px]">Kind</Label>
        <Select
          value={createDraft.kind || '__none__'}
          onValueChange={(value) =>
            onDraftChange({
              ...createDraft,
              kind: value === '__none__' ? '' : value,
            })
          }
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {RELATIONSHIP_KIND_OPTIONS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {createError && (
        <p className="text-[10px] text-red-600 dark:text-red-400">{createError}</p>
      )}
    </div>
  );
}

interface RelationshipRowProps {
  item: ConnectedRelationship;
  direction: 'incoming' | 'outgoing';
  designEntities: DependencyNode[];
  editingRelationshipId: string | null;
  relationshipDraft: RelationshipDraft | null;
  relationshipError: string | null;
  onBeginEdit: (relationshipId: string) => void;
  onCancelEdit: () => void;
  onDraftChange: (draft: RelationshipDraft) => void;
  onSave: (relationshipId: string) => void;
  onDelete: (relationshipId: string) => void;
}

function RelationshipRow({
  item,
  direction,
  designEntities,
  editingRelationshipId,
  relationshipDraft,
  relationshipError,
  onBeginEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
  onDelete,
}: RelationshipRowProps) {
  const isEditing = editingRelationshipId === item.edge.id;

  return (
    <div className="p-2 rounded-md border border-border bg-card/50 hover:bg-card transition-colors">
      {isEditing && relationshipDraft ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground font-mono">{item.edge.id}</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => onSave(item.edge.id)}>
                Save
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px]">Label</Label>
            <Input
              value={relationshipDraft.label}
              onChange={(event) => onDraftChange({ ...relationshipDraft, label: event.target.value })}
              className="h-7 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px]">Kind</Label>
            <Select
              value={relationshipDraft.kind || '__none__'}
              onValueChange={(value) =>
                onDraftChange({
                  ...relationshipDraft,
                  kind: value === '__none__' ? '' : value,
                })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {RELATIONSHIP_KIND_OPTIONS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <EntityEndpointSelect
            label="Source"
            value={relationshipDraft.sourceId}
            entities={designEntities}
            onChange={(sourceId) => onDraftChange({ ...relationshipDraft, sourceId })}
          />

          <EntityEndpointSelect
            label="Target"
            value={relationshipDraft.targetId}
            entities={designEntities}
            onChange={(targetId) => onDraftChange({ ...relationshipDraft, targetId })}
          />

          {relationshipError && (
            <p className="text-[10px] text-red-600 dark:text-red-400">{relationshipError}</p>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] gap-1 text-red-600 dark:text-red-400"
            onClick={() => onDelete(item.edge.id)}
          >
            <Trash2 className="h-3 w-3" />
            Delete relationship
          </Button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium mb-0.5 truncate">{item.connectedNode.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {direction === 'incoming' ? 'from' : 'to'} {item.connectedNode.type.replace('-', ' ')}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {item.edge.label && (
                <Badge variant="outline" className="text-[10px]">
                  {item.edge.label}
                </Badge>
              )}
              {item.kind && (
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {item.kind}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] gap-1 shrink-0"
            onClick={() => onBeginEdit(item.edge.id)}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}

export function DependencyInspector({ selectedNode }: DependencyInspectorProps) {
  const [isEditingEntity, setIsEditingEntity] = useState(false);
  const [entityDraft, setEntityDraft] = useState<EntityDraft | null>(null);
  const [entitySaveError, setEntitySaveError] = useState<string | null>(null);
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [relationshipDraft, setRelationshipDraft] = useState<RelationshipDraft | null>(null);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [isCreatingRelationship, setIsCreatingRelationship] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateRelationshipDraft | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setIsEditingEntity(false);
    setEntityDraft(null);
    setEntitySaveError(null);
    setEditingRelationshipId(null);
    setRelationshipDraft(null);
    setRelationshipError(null);
    setIsCreatingRelationship(false);
    setCreateDraft(null);
    setCreateError(null);
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Dependency Inspector</h3>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <Network className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              Select a node to view dependencies and impact analysis
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dependencyNodes = getDependencyNodes();
  const dependencyEdges = getDependencyEdges();

  const incomingRelationships: ConnectedRelationship[] = dependencyEdges
    .filter((edge) => edge.target === selectedNode.id)
    .map((edge) => {
      const connectedNode = dependencyNodes.find((node) => node.id === edge.source);
      if (!connectedNode) {
        return null;
      }
      return {
        edge,
        connectedNode,
        kind: findRelationship(edge.id)?.relationship.kind,
      };
    })
    .filter((item): item is ConnectedRelationship => item !== null);

  const outgoingRelationships: ConnectedRelationship[] = dependencyEdges
    .filter((edge) => edge.source === selectedNode.id)
    .map((edge) => {
      const connectedNode = dependencyNodes.find((node) => node.id === edge.target);
      if (!connectedNode) {
        return null;
      }
      return {
        edge,
        connectedNode,
        kind: findRelationship(edge.id)?.relationship.kind,
      };
    })
    .filter((item): item is ConnectedRelationship => item !== null);

  const getDescendants = (nodeId: string, visited = new Set<string>()): DependencyNode[] => {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const children = dependencyEdges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => edge.target);

    const descendants: DependencyNode[] = [];
    children.forEach((childId) => {
      const childNode = dependencyNodes.find((node) => node.id === childId);
      if (childNode) {
        descendants.push(childNode);
        descendants.push(...getDescendants(childId, visited));
      }
    });

    return descendants;
  };

  const indirectImpacts = getDescendants(selectedNode.id).filter(
    (node) => !outgoingRelationships.some((relationship) => relationship.connectedNode.id === node.id)
  );

  const statusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      complete: 'text-green-600 dark:text-green-400 border-green-500/30',
      incomplete: 'text-amber-600 dark:text-amber-400 border-amber-500/30',
      'validation-issue': 'text-red-600 dark:text-red-400 border-red-500/30',
      'ai-recommendation': 'text-blue-600 dark:text-blue-400 border-blue-500/30',
      'recently-modified': 'text-purple-600 dark:text-purple-400 border-purple-500/30',
    };
    return colors[status] || 'text-muted-foreground border-border';
  };

  const cancelRelationshipEdit = () => {
    setEditingRelationshipId(null);
    setRelationshipDraft(null);
    setRelationshipError(null);
  };

  const cancelCreateRelationship = () => {
    setIsCreatingRelationship(false);
    setCreateDraft(null);
    setCreateError(null);
  };

  const beginEntityEdit = () => {
    cancelRelationshipEdit();
    cancelCreateRelationship();
    setEntityDraft(toEntityDraft(selectedNode));
    setEntitySaveError(null);
    setIsEditingEntity(true);
  };

  const cancelEntityEdit = () => {
    setEntityDraft(null);
    setEntitySaveError(null);
    setIsEditingEntity(false);
  };

  const beginRelationshipEdit = (relationshipId: string) => {
    cancelEntityEdit();
    cancelCreateRelationship();
    const draft = toRelationshipDraft(relationshipId);
    if (!draft) {
      setRelationshipError('Relationship not found.');
      return;
    }

    setEditingRelationshipId(relationshipId);
    setRelationshipDraft(draft);
    setRelationshipError(null);
  };

  const beginCreateRelationship = () => {
    cancelEntityEdit();
    cancelRelationshipEdit();
    setCreateDraft({
      direction: 'outgoing',
      otherEntityId: '',
      label: '',
      kind: '',
    });
    setCreateError(null);
    setIsCreatingRelationship(true);
  };

  const toggleStatus = (status: NodeStatus, checked: boolean) => {
    setEntityDraft((current) => {
      if (!current) return current;
      const nextStatus = checked
        ? [...current.status, status]
        : current.status.filter((item) => item !== status);
      return { ...current, status: nextStatus };
    });
  };

  const handleEntitySave = () => {
    if (!entityDraft) return;

    const patch = {
      name: entityDraft.name.trim(),
      description: entityDraft.description.trim() || undefined,
      sectionRef: entityDraft.sectionRef.trim() || undefined,
      status: entityDraft.status,
    };

    if (!patch.name) {
      setEntitySaveError('Name is required.');
      return;
    }

    const saved = updateDesignEntity(selectedNode.id, patch);
    if (!saved) {
      setEntitySaveError('Save failed. Check that the section reference matches a valid section id.');
      return;
    }

    setEntitySaveError(null);
    setIsEditingEntity(false);
    setEntityDraft(null);
  };

  const handleRelationshipSave = (relationshipId: string) => {
    if (!relationshipDraft) return;

    const sourceId = relationshipDraft.sourceId.trim();
    const targetId = relationshipDraft.targetId.trim();

    if (!sourceId || !targetId) {
      setRelationshipError('Source and target ids are required.');
      return;
    }

    const patch = {
      sourceId,
      targetId,
      label: relationshipDraft.label.trim() || undefined,
      ...(relationshipDraft.kind.trim() ? { kind: relationshipDraft.kind.trim() as RelationshipKind } : {}),
    };

    const saved = updateRelationship(relationshipId, patch);
    if (!saved) {
      setRelationshipError('Save failed. Check that source and target ids match existing design entities.');
      return;
    }

    cancelRelationshipEdit();
  };

  const handleCreateRelationshipSave = () => {
    if (!createDraft) return;

    if (!createDraft.otherEntityId) {
      setCreateError('Select another entity.');
      return;
    }

    const { sourceId, targetId } = resolveRelationshipEndpoints(
      selectedNode.id,
      createDraft.direction,
      createDraft.otherEntityId
    );

    if (sourceId === targetId) {
      setCreateError('Source and target must be different entities.');
      return;
    }

    const created = createRelationship({
      id: generateRelationshipId(),
      sourceId,
      targetId,
      label: createDraft.label.trim() || undefined,
      ...(createDraft.kind.trim() ? { kind: createDraft.kind.trim() as RelationshipKind } : {}),
    });

    if (!created) {
      setCreateError('Create failed. Check the selected entity and try again.');
      return;
    }

    cancelCreateRelationship();
  };

  const handleRelationshipDelete = (relationshipId: string) => {
    if (!window.confirm('Delete this relationship?')) {
      return;
    }

    const deleted = deleteRelationship(relationshipId);
    if (!deleted) {
      setRelationshipError('Delete failed. Relationship may have already been removed.');
      return;
    }

    cancelRelationshipEdit();
  };

  const displayNode =
    isEditingEntity && entityDraft
      ? { ...selectedNode, ...entityDraft, sectionId: entityDraft.sectionRef || undefined }
      : selectedNode;

  const relationshipRowProps = {
    designEntities: dependencyNodes,
    editingRelationshipId,
    relationshipDraft,
    relationshipError,
    onBeginEdit: beginRelationshipEdit,
    onCancelEdit: cancelRelationshipEdit,
    onDraftChange: setRelationshipDraft,
    onSave: handleRelationshipSave,
    onDelete: handleRelationshipDelete,
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Dependency Inspector</h3>
          </div>
          {!isEditingEntity ? (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={beginEntityEdit}>
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={cancelEntityEdit}>
                <X className="h-3 w-3" />
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleEntitySave}>
                <Save className="h-3 w-3" />
                Save
              </Button>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            {isEditingEntity && entityDraft ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="entity-name" className="text-xs">
                    Name
                  </Label>
                  <Input
                    id="entity-name"
                    value={entityDraft.name}
                    onChange={(event) => setEntityDraft({ ...entityDraft, name: event.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="entity-description" className="text-xs">
                    Description
                  </Label>
                  <Textarea
                    id="entity-description"
                    value={entityDraft.description}
                    onChange={(event) => setEntityDraft({ ...entityDraft, description: event.target.value })}
                    className="text-xs min-h-[72px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="entity-section-ref" className="text-xs">
                    Section reference
                  </Label>
                  <Input
                    id="entity-section-ref"
                    value={entityDraft.sectionRef}
                    onChange={(event) => setEntityDraft({ ...entityDraft, sectionRef: event.target.value })}
                    placeholder="e.g. 3"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Status</Label>
                  <div className="space-y-2">
                    {STATUS_OPTIONS.map((status) => (
                      <div key={status} className="flex items-center gap-2">
                        <Checkbox
                          id={`status-${status}`}
                          checked={entityDraft.status.includes(status)}
                          onCheckedChange={(checked) => toggleStatus(status, checked === true)}
                        />
                        <Label htmlFor={`status-${status}`} className="text-xs font-normal capitalize">
                          {status.replace('-', ' ')}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {entitySaveError && (
                  <div className="p-2 rounded-md border border-red-500/30 bg-red-500/10">
                    <p className="text-xs text-red-600 dark:text-red-400">{entitySaveError}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">{displayNode.name}</h4>
                    <p className="text-xs text-muted-foreground capitalize">
                      {displayNode.type.replace('-', ' ')}
                    </p>
                  </div>
                  {displayNode.sectionId && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {displayNode.sectionId}
                    </Button>
                  )}
                </div>

                {displayNode.description && (
                  <p className="text-xs text-muted-foreground mb-3">{displayNode.description}</p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {displayNode.status.map((status) => (
                    <Badge key={status} variant="outline" className={`text-xs ${statusBadgeColor(status)}`}>
                      {status.replace('-', ' ')}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-sm">Relationships</h4>
              {!isCreatingRelationship && !editingRelationshipId && !isEditingEntity && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={beginCreateRelationship}
                >
                  <Plus className="h-3 w-3" />
                  Create Relationship
                </Button>
              )}
            </div>

            {isCreatingRelationship && createDraft && (
              <CreateRelationshipPanel
                selectedNode={selectedNode}
                designEntities={dependencyNodes}
                createDraft={createDraft}
                createError={createError}
                onDraftChange={setCreateDraft}
                onCancel={cancelCreateRelationship}
                onSave={handleCreateRelationshipSave}
              />
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Parent Dependencies</h4>
              <Badge variant="secondary" className="text-xs">
                {incomingRelationships.length}
              </Badge>
            </div>
            {incomingRelationships.length === 0 ? (
              <p className="text-xs text-muted-foreground">No parent dependencies</p>
            ) : (
              <div className="space-y-2">
                {incomingRelationships.map((item) => (
                  <RelationshipRow
                    key={item.edge.id}
                    item={item}
                    direction="incoming"
                    {...relationshipRowProps}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Child Dependencies</h4>
              <Badge variant="secondary" className="text-xs">
                {outgoingRelationships.length}
              </Badge>
            </div>
            {outgoingRelationships.length === 0 ? (
              <p className="text-xs text-muted-foreground">No child dependencies</p>
            ) : (
              <div className="space-y-2">
                {outgoingRelationships.map((item) => (
                  <RelationshipRow
                    key={item.edge.id}
                    item={item}
                    direction="outgoing"
                    {...relationshipRowProps}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Impact Analysis</h4>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-2">Direct Impacts ({outgoingRelationships.length})</p>
                <p className="text-xs text-muted-foreground">
                  Changes to this {selectedNode.type.replace('-', ' ')} will directly affect{' '}
                  {outgoingRelationships.length === 0
                    ? 'no downstream elements'
                    : `${outgoingRelationships.length} downstream ${outgoingRelationships.length === 1 ? 'element' : 'elements'}`}
                  .
                </p>
              </div>
              {indirectImpacts.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Indirect Impacts ({indirectImpacts.length})</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Additional elements affected through cascading dependencies:
                  </p>
                  <div className="space-y-1.5">
                    {indirectImpacts.slice(0, 5).map((node, idx) => (
                      <div key={idx} className="text-xs p-1.5 rounded bg-card/30 border border-border/50">
                        {node.name}
                      </div>
                    ))}
                    {indirectImpacts.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{indirectImpacts.length - 5} more affected elements
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedNode.status.includes('validation-issue') && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <h4 className="font-semibold text-sm">Validation Issues</h4>
                </div>
                <div className="p-3 rounded-md border border-red-500/30 bg-red-500/10">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    This element has validation issues that need to be resolved.
                  </p>
                </div>
              </div>
            </>
          )}

          {selectedNode.status.includes('ai-recommendation') && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <h4 className="font-semibold text-sm">AI Recommendations</h4>
                </div>
                <div className="p-3 rounded-md border border-blue-500/30 bg-blue-500/10">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    AI copilot has suggestions for improving this element.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
