import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Search, Filter, Network } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { dependencyNodes, dependencyEdges } from '../data/dependencyGraphData';
import type { DependencyNode, NodeStatus, GraphViewMode, NodeType } from '../types/dependencyGraph';

const nodeTypeColors: Record<string, string> = {
  objective: '#3b82f6',
  endpoint: '#8b5cf6',
  estimand: '#a855f7',
  assessment: '#06b6d4',
  visit: '#10b981',
  'soa-row': '#14b8a6',
  'study-arm': '#f59e0b',
  population: '#ef4444',
  eligibility: '#f97316',
  intervention: '#eab308',
  'statistical-analysis': '#6366f1',
  biomarker: '#ec4899',
  'safety-assessment': '#dc2626',
  'protocol-section': '#64748b',
};

const statusColors: Record<NodeStatus, string> = {
  complete: '#10b981',
  incomplete: '#f59e0b',
  'validation-issue': '#ef4444',
  'ai-recommendation': '#3b82f6',
  'recently-modified': '#8b5cf6',
};

interface DependencyGraphProps {
  onNodeDoubleClick?: (nodeId: string, sectionId?: string) => void;
  onNodeSelect?: (node: DependencyNode | null) => void;
}

export function DependencyGraph({ onNodeDoubleClick, onNodeSelect }: DependencyGraphProps) {
  const [viewMode, setViewMode] = useState<GraphViewMode>('clinical-design');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Convert dependency nodes to ReactFlow nodes with positioning
  const initialNodes: Node[] = useMemo(() => {
    return dependencyNodes.map((node, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;

      return {
        id: node.id,
        type: 'default',
        data: {
          label: (
            <div className="text-xs">
              <div className="font-semibold mb-1">{node.name}</div>
              <div className="text-[10px] text-muted-foreground capitalize">{node.type.replace('-', ' ')}</div>
              <div className="flex gap-1 mt-1">
                {node.status.map((status) => (
                  <div
                    key={status}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: statusColors[status] }}
                    title={status}
                  />
                ))}
              </div>
            </div>
          ),
          node,
        },
        position: { x: col * 300, y: row * 150 },
        style: {
          background: nodeTypeColors[node.type] || '#64748b',
          color: 'white',
          border: selectedNodeId === node.id ? '3px solid white' : '1px solid rgba(255,255,255,0.3)',
          borderRadius: '8px',
          padding: '12px',
          width: 250,
          fontSize: '12px',
          boxShadow: selectedNodeId === node.id
            ? '0 0 20px rgba(255,255,255,0.5)'
            : hoveredNodeId === node.id
            ? '0 0 15px rgba(255,255,255,0.3)'
            : '0 2px 8px rgba(0,0,0,0.2)',
          opacity: selectedNodeId && selectedNodeId !== node.id && !isConnectedNode(node.id, selectedNodeId) ? 0.3 : 1,
          transition: 'all 0.2s ease',
        },
      };
    });
  }, [selectedNodeId, hoveredNodeId]);

  const isConnectedNode = useCallback((nodeId: string, targetId: string): boolean => {
    return dependencyEdges.some(
      (edge) =>
        (edge.source === targetId && edge.target === nodeId) ||
        (edge.target === targetId && edge.source === nodeId)
    );
  }, []);

  // Convert dependency edges to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    return dependencyEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: selectedNodeId ? (edge.source === selectedNodeId || edge.target === selectedNodeId) : false,
      style: {
        stroke: selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
          ? '#ffffff'
          : 'rgba(255,255,255,0.4)',
        strokeWidth: selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId) ? 3 : 1.5,
        opacity: selectedNodeId && edge.source !== selectedNodeId && edge.target !== selectedNodeId ? 0.2 : 1,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
          ? '#ffffff'
          : 'rgba(255,255,255,0.4)',
      },
      labelStyle: {
        fill: 'white',
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: 'rgba(0,0,0,0.6)',
      },
    }));
  }, [selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when selection changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [selectedNodeId, hoveredNodeId, setNodes, initialNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [selectedNodeId, setEdges, initialEdges]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const depNode = dependencyNodes.find((n) => n.id === node.id);
      setSelectedNodeId(node.id);
      if (onNodeSelect && depNode) {
        onNodeSelect(depNode);
      }
    },
    [onNodeSelect]
  );

  const onNodeDoubleClickHandler = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const depNode = dependencyNodes.find((n) => n.id === node.id);
      if (onNodeDoubleClick && depNode) {
        onNodeDoubleClick(node.id, depNode.sectionId);
      }
    },
    [onNodeDoubleClick]
  );

  const onNodeMouseEnter = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setHoveredNodeId(node.id);
    },
    []
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    if (onNodeSelect) {
      onNodeSelect(null);
    }
  }, [onNodeSelect]);

  return (
    <div className="h-full w-full relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClickHandler}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#475569" gap={16} />
        <Controls />

        <Panel position="top-left" className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">2D Graph Controls</h3>
          </div>

          <div className="space-y-2">
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as GraphViewMode)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select view mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="protocol-structure">Protocol Structure</SelectItem>
                <SelectItem value="clinical-design">Clinical Design</SelectItem>
                <SelectItem value="regulatory">Regulatory</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="text-xs font-medium mb-2">Legend</div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Incomplete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Issue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>AI Rec</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-muted-foreground">
            <div>Double-click node to open section</div>
            <div>Drag nodes to rearrange</div>
            <div>Scroll to zoom</div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
