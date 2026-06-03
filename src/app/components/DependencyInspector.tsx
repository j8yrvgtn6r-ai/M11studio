import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import {
  Network,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import type { DependencyNode } from '../types/dependencyGraph';
import { getDependencyEdges, getDependencyNodes } from '../domain/protocol';

const dependencyNodes = getDependencyNodes();
const dependencyEdges = getDependencyEdges();

interface DependencyInspectorProps {
  selectedNode: DependencyNode | null;
}

export function DependencyInspector({ selectedNode }: DependencyInspectorProps) {
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

  // Find parent dependencies (incoming edges)
  const parentDeps = dependencyEdges
    .filter((edge) => edge.target === selectedNode.id)
    .map((edge) => {
      const node = dependencyNodes.find((n) => n.id === edge.source);
      return { node, label: edge.label };
    })
    .filter((dep) => dep.node);

  // Find child dependencies (outgoing edges)
  const childDeps = dependencyEdges
    .filter((edge) => edge.source === selectedNode.id)
    .map((edge) => {
      const node = dependencyNodes.find((n) => n.id === edge.target);
      return { node, label: edge.label };
    })
    .filter((dep) => dep.node);

  // Calculate indirect impacts (descendants)
  const getDescendants = (nodeId: string, visited = new Set<string>()): DependencyNode[] => {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const children = dependencyEdges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => edge.target);

    const descendants: DependencyNode[] = [];
    children.forEach((childId) => {
      const childNode = dependencyNodes.find((n) => n.id === childId);
      if (childNode) {
        descendants.push(childNode);
        descendants.push(...getDescendants(childId, visited));
      }
    });

    return descendants;
  };

  const indirectImpacts = getDescendants(selectedNode.id).filter(
    (node) => !childDeps.find((dep) => dep.node?.id === node.id)
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

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Dependency Inspector</h3>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Node Info */}
          <div>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-sm mb-1">{selectedNode.name}</h4>
                <p className="text-xs text-muted-foreground capitalize">
                  {selectedNode.type.replace('-', ' ')}
                </p>
              </div>
              {selectedNode.sectionId && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {selectedNode.sectionId}
                </Button>
              )}
            </div>

            {selectedNode.description && (
              <p className="text-xs text-muted-foreground mb-3">{selectedNode.description}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {selectedNode.status.map((status) => (
                <Badge key={status} variant="outline" className={`text-xs ${statusBadgeColor(status)}`}>
                  {status.replace('-', ' ')}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Parent Dependencies */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Parent Dependencies</h4>
              <Badge variant="secondary" className="text-xs">
                {parentDeps.length}
              </Badge>
            </div>
            {parentDeps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No parent dependencies</p>
            ) : (
              <div className="space-y-2">
                {parentDeps.map((dep, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-md border border-border bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium mb-0.5">{dep.node?.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {dep.node?.type.replace('-', ' ')}
                        </p>
                        {dep.label && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {dep.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Child Dependencies */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Child Dependencies</h4>
              <Badge variant="secondary" className="text-xs">
                {childDeps.length}
              </Badge>
            </div>
            {childDeps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No child dependencies</p>
            ) : (
              <div className="space-y-2">
                {childDeps.map((dep, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-md border border-border bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium mb-0.5">{dep.node?.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {dep.node?.type.replace('-', ' ')}
                        </p>
                        {dep.label && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {dep.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Impact Analysis */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Impact Analysis</h4>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-2">Direct Impacts ({childDeps.length})</p>
                <p className="text-xs text-muted-foreground">
                  Changes to this {selectedNode.type.replace('-', ' ')} will directly affect{' '}
                  {childDeps.length === 0
                    ? 'no downstream elements'
                    : `${childDeps.length} downstream ${childDeps.length === 1 ? 'element' : 'elements'}`}
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

          {/* Validation Issues */}
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

          {/* AI Recommendations */}
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
