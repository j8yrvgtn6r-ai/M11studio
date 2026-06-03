import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/node-editor.css';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ProtocolNode } from './nodes/ProtocolNode';
import { Maximize2, Minimize2, RefreshCw, Grid3x3, Network } from 'lucide-react';
import { getDependencyEdges, getDependencyNodes } from '../domain/protocol';
import type { DependencyNode } from '../types/dependencyGraph';

const dependencyNodes = getDependencyNodes();
const dependencyEdges = getDependencyEdges();

const nodeTypes = {
  protocolNode: ProtocolNode,
};

type EdgeStyle = 'solid' | 'dashed' | 'dotted' | 'double';
type LayoutMode = 'freeform' | 'dependency-flow' | 'swim-lane' | 'force-directed';

interface DependencyGraphNodeEditorProps {
  onNodeDoubleClick?: (nodeId: string, sectionId?: string) => void;
  onNodeSelect?: (node: DependencyNode | null) => void;
}

export function DependencyGraphNodeEditor({
  onNodeDoubleClick,
  onNodeSelect,
}: DependencyGraphNodeEditorProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('dependency-flow');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Calculate port positions for each node
  const getNodePorts = (nodeId: string) => {
    const incomingEdges = dependencyEdges.filter((e) => e.target === nodeId);
    const outgoingEdges = dependencyEdges.filter((e) => e.source === nodeId);
    return {
      inputs: Math.max(incomingEdges.length, 1),
      outputs: Math.max(outgoingEdges.length, 1),
    };
  };

  // Layout algorithms
  const calculateLayout = useCallback(
    (mode: LayoutMode) => {
      switch (mode) {
        case 'dependency-flow':
          return calculateDependencyFlowLayout();
        case 'swim-lane':
          return calculateSwimLaneLayout();
        case 'force-directed':
          return calculateForceDirectedLayout();
        default:
          return calculateFreeformLayout();
      }
    },
    []
  );

  const calculateDependencyFlowLayout = () => {
    // Topological sort to arrange nodes in dependency order
    const positions: Record<string, { x: number; y: number }> = {};
    const levels: Record<string, number> = {};

    // Calculate depth levels
    const calculateLevel = (nodeId: string, visited = new Set<string>()): number => {
      if (levels[nodeId] !== undefined) return levels[nodeId];
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const parents = dependencyEdges
        .filter((e) => e.target === nodeId)
        .map((e) => e.source);

      if (parents.length === 0) {
        levels[nodeId] = 0;
        return 0;
      }

      const maxParentLevel = Math.max(...parents.map((p) => calculateLevel(p, visited)));
      levels[nodeId] = maxParentLevel + 1;
      return levels[nodeId];
    };

    dependencyNodes.forEach((node) => calculateLevel(node.id));

    // Group nodes by level
    const nodesByLevel: Record<number, string[]> = {};
    Object.entries(levels).forEach(([nodeId, level]) => {
      if (!nodesByLevel[level]) nodesByLevel[level] = [];
      nodesByLevel[level].push(nodeId);
    });

    // Position nodes with better spacing
    const levelSpacing = 350;
    const nodeSpacing = 140;

    Object.entries(nodesByLevel).forEach(([level, nodeIds]) => {
      const levelNum = parseInt(level);
      const levelHeight = nodeIds.length * nodeSpacing;

      nodeIds.forEach((nodeId, index) => {
        positions[nodeId] = {
          x: levelNum * levelSpacing + 50,
          y: index * nodeSpacing - levelHeight / 2 + 400,
        };
      });
    });

    return positions;
  };

  const calculateSwimLaneLayout = () => {
    const positions: Record<string, { x: number; y: number }> = {};
    const lanes: Record<string, string[]> = {};

    // Group by type
    dependencyNodes.forEach((node) => {
      if (!lanes[node.type]) lanes[node.type] = [];
      lanes[node.type].push(node.id);
    });

    let laneIndex = 0;
    Object.entries(lanes).forEach(([type, nodeIds]) => {
      nodeIds.forEach((nodeId, index) => {
        positions[nodeId] = {
          x: index * 250,
          y: laneIndex * 150,
        };
      });
      laneIndex++;
    });

    return positions;
  };

  const calculateForceDirectedLayout = () => {
    // Simple force-directed layout
    const positions: Record<string, { x: number; y: number }> = {};

    dependencyNodes.forEach((node, index) => {
      const angle = (index / dependencyNodes.length) * 2 * Math.PI;
      const radius = 300;
      positions[node.id] = {
        x: Math.cos(angle) * radius + 400,
        y: Math.sin(angle) * radius + 400,
      };
    });

    return positions;
  };

  const calculateFreeformLayout = () => {
    const positions: Record<string, { x: number; y: number }> = {};

    dependencyNodes.forEach((node, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      positions[node.id] = {
        x: col * 300,
        y: row * 150,
      };
    });

    return positions;
  };

  // Convert to ReactFlow nodes
  const initialNodes: Node[] = useMemo(() => {
    const positions = calculateLayout(layoutMode);

    return dependencyNodes.map((node) => {
      const ports = getNodePorts(node.id);
      const pos = positions[node.id] || { x: 0, y: 0 };

      return {
        id: node.id,
        type: 'protocolNode',
        position: pos,
        data: {
          name: node.name,
          type: node.type,
          status: node.status,
          inputs: ports.inputs,
          outputs: ports.outputs,
          sectionId: node.sectionId,
          node,
        },
      };
    });
  }, [layoutMode]);

  // Determine edge style based on relationship
  const getEdgeStyle = (sourceType: string, targetType: string): EdgeStyle => {
    // Critical path: Objective -> Endpoint -> Assessment
    if (
      (sourceType === 'objective' && targetType === 'endpoint') ||
      (sourceType === 'endpoint' && targetType === 'assessment')
    ) {
      return 'double';
    }

    // Direct dependency: most relationships
    if (
      sourceType === 'assessment' && targetType === 'visit' ||
      sourceType === 'endpoint' && targetType === 'statistical-analysis'
    ) {
      return 'solid';
    }

    // Reference relationship
    if (sourceType === 'biomarker') {
      return 'dotted';
    }

    // Indirect dependency
    return 'dashed';
  };

  // Convert to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    return dependencyEdges.map((edge) => {
      const sourceNode = dependencyNodes.find((n) => n.id === edge.source);
      const targetNode = dependencyNodes.find((n) => n.id === edge.target);
      const edgeStyle = getEdgeStyle(sourceNode?.type || '', targetNode?.type || '');

      let strokeDasharray = '';
      let strokeWidth = 2;
      const isSelected = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);

      switch (edgeStyle) {
        case 'dashed':
          strokeDasharray = '8 4';
          strokeWidth = 2;
          break;
        case 'dotted':
          strokeDasharray = '2 4';
          strokeWidth = 2;
          break;
        case 'double':
          strokeWidth = 3.5;
          break;
        default:
          strokeWidth = 2;
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: 'out-0',
        targetHandle: 'in-0',
        type: 'smoothstep',
        label: edge.label,
        animated: isSelected,
        style: {
          stroke: isSelected ? '#60a5fa' : '#475569',
          strokeWidth: isSelected ? strokeWidth + 0.5 : strokeWidth,
          strokeDasharray,
          opacity: selectedNodeId && !isSelected ? 0.15 : 0.75,
        },
        labelStyle: {
          fill: isSelected ? '#e0f2fe' : '#94a3b8',
          fontSize: 10,
          fontFamily: 'SF Mono, Monaco, Inconsolata, monospace',
          fontWeight: isSelected ? 600 : 400,
        },
        labelBgStyle: {
          fill: '#0f172a',
          fillOpacity: 0.95,
          rx: 3,
          ry: 3,
        },
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 3,
      };
    });
  }, [selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when layout changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [layoutMode, setNodes, initialNodes]);

  // Update edges when selection changes
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

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    if (onNodeSelect) {
      onNodeSelect(null);
    }
  }, [onNodeSelect]);

  const handleRelayout = () => {
    setNodes(initialNodes);
  };

  return (
    <div className="h-full w-full relative bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClickHandler}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#1e293b"
          gap={20}
          size={1}
          variant={BackgroundVariant.Lines}
        />
        <Controls
          className="bg-slate-900/90 border border-slate-700 rounded-lg"
          showInteractive={false}
        />
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => {
              if (node.id === selectedNodeId) return '#3b82f6';
              return '#334155';
            }}
            maskColor="rgba(15, 23, 42, 0.9)"
            className="bg-slate-900/90 border border-slate-700 rounded-lg"
          />
        )}

        <Panel position="top-left" className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-xl space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-mono font-semibold text-slate-200">Node Editor</h3>
          </div>

          <div className="space-y-2">
            <Select value={layoutMode} onValueChange={(value) => setLayoutMode(value as LayoutMode)}>
              <SelectTrigger className="h-8 text-xs font-mono bg-slate-800 border-slate-600">
                <SelectValue placeholder="Layout Mode" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="freeform" className="text-xs font-mono">Freeform</SelectItem>
                <SelectItem value="dependency-flow" className="text-xs font-mono">Dependency Flow</SelectItem>
                <SelectItem value="swim-lane" className="text-xs font-mono">Swim Lane</SelectItem>
                <SelectItem value="force-directed" className="text-xs font-mono">Force Directed</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRelayout}
                className="h-7 text-xs font-mono bg-slate-800 border-slate-600 hover:bg-slate-700"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset Layout
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowMiniMap(!showMiniMap)}
                className="h-7 text-xs font-mono bg-slate-800 border-slate-600 hover:bg-slate-700 px-2"
              >
                {showMiniMap ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
              Connection Types
            </div>
            <div className="space-y-2 text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <svg width="24" height="2" className="shrink-0">
                  <line x1="0" y1="1" x2="24" y2="1" stroke="#94a3b8" strokeWidth="2" />
                </svg>
                <span className="text-[9px]">Direct</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="24" height="2" className="shrink-0">
                  <line x1="0" y1="1" x2="24" y2="1" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 2" />
                </svg>
                <span className="text-[9px]">Indirect</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="24" height="2" className="shrink-0">
                  <line x1="0" y1="1" x2="24" y2="1" stroke="#94a3b8" strokeWidth="2" strokeDasharray="1 2" />
                </svg>
                <span className="text-[9px]">Reference</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="24" height="3" className="shrink-0">
                  <line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#94a3b8" strokeWidth="3.5" />
                </svg>
                <span className="text-[9px]">Critical Path</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
              Status Colors
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono text-slate-400">
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
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span>Modified</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700">
            <div className="text-[10px] font-mono text-slate-400 space-y-1">
              <div>• Click: Select node</div>
              <div>• Double-click: Open section</div>
              <div>• Drag: Move node</div>
              <div>• Scroll: Zoom</div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
