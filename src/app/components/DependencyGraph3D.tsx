import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Search, Target, GitBranch, Maximize2, RefreshCw, Home, X, Focus, ZoomIn } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { getDependencyEdges, getDependencyNodes } from '../domain/protocol';
import type { DependencyNode, NodeStatus } from '../types/dependencyGraph';

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

interface DependencyGraph3DProps {
  graphRevision?: number;
  onNodeDoubleClick?: (nodeId: string, sectionId?: string) => void;
  onNodeSelect?: (node: DependencyNode | null) => void;
  selectedNodeId?: string | null;
  searchQuery?: string;
}

export function DependencyGraph3D({
  graphRevision = 0,
  onNodeDoubleClick,
  onNodeSelect,
  selectedNodeId,
  searchQuery = '',
}: DependencyGraph3DProps) {
  const fgRef = useRef<any>();
  const dependencyNodes = useMemo(() => getDependencyNodes(), [graphRevision]);
  const dependencyEdges = useMemo(() => getDependencyEdges(), [graphRevision]);
  const [impactAnalysisMode, setImpactAnalysisMode] = useState(false);
  const [tracePathMode, setTracePathMode] = useState(false);
  const [pathStartNode, setPathStartNode] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<string>('full-protocol');
  const [cameraDistance, setCameraDistance] = useState(400);

  // Abbreviate node names based on distance
  const getAbbreviatedName = (name: string): string => {
    const abbreviations: Record<string, string> = {
      'Primary Objective: Overall Survival': 'OS',
      'Secondary Objective: Progression-Free Survival': 'PFS Obj',
      'Overall Survival': 'OS',
      'Progression-Free Survival': 'PFS',
      'PSA Response Rate': 'PSA',
      'Tumor Assessment (CT/MRI)': 'Tumor',
      'PSA Level': 'PSA',
      'Safety Labs': 'Labs',
      'Screening Visit': 'Screening',
      'Cycle 1 Day 1': 'C1D1',
      'Follow-up Visits': 'Follow-up',
      'Primary Analysis: OS': 'OS Stats',
      'Secondary Analysis: PFS': 'PFS Stats',
      '177Lu-PSMA-617 + BSC': 'Exp Arm',
      'Best Standard Care': 'Control',
      'Target Population': 'Population',
      'PSMA-positive on PET scan': 'PSMA+',
      'Progressive mCRPC': 'mCRPC',
      'PSMA Expression': 'PSMA',
      '177Lu-PSMA-617': 'Treatment',
      'Adverse Event Monitoring': 'AE Monitor',
    };
    return abbreviations[name] || name.split(' ').slice(0, 2).join(' ');
  };

  // Convert dependency nodes to 3D graph format
  const graphData = useMemo(() => {
    const nodes = dependencyNodes.map((node) => ({
      id: node.id,
      name: node.name,
      abbreviatedName: getAbbreviatedName(node.name),
      type: node.type,
      status: node.status,
      color: nodeTypeColors[node.type] || '#64748b',
      node: node,
    }));

    const links = dependencyEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      label: edge.label,
    }));

    return { nodes, links };
  }, [dependencyNodes, dependencyEdges]);

  // Get connected nodes for highlighting
  const getConnectedNodes = useCallback(
    (nodeId: string) => {
      const connected = new Set<string>([nodeId]);
      const upstream = new Set<string>();
      const downstream = new Set<string>();

      // Find direct connections
      dependencyEdges.forEach((edge) => {
        if (edge.source === nodeId) {
          connected.add(edge.target);
          downstream.add(edge.target);
        }
        if (edge.target === nodeId) {
          connected.add(edge.source);
          upstream.add(edge.source);
        }
      });

      // Find all downstream dependencies recursively
      const findDownstream = (id: string, visited = new Set<string>()) => {
        if (visited.has(id)) return;
        visited.add(id);
        downstream.add(id);

        dependencyEdges.forEach((edge) => {
          if (edge.source === id) {
            findDownstream(edge.target, visited);
          }
        });
      };

      // Find all upstream dependencies recursively
      const findUpstream = (id: string, visited = new Set<string>()) => {
        if (visited.has(id)) return;
        visited.add(id);
        upstream.add(id);

        dependencyEdges.forEach((edge) => {
          if (edge.target === id) {
            findUpstream(edge.source, visited);
          }
        });
      };

      if (impactAnalysisMode) {
        // In impact analysis mode, show all downstream
        downstream.forEach((id) => findDownstream(id));
        downstream.forEach((id) => connected.add(id));
      }

      return { all: connected, upstream, downstream };
    },
    [dependencyEdges, impactAnalysisMode]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (node: any) => {
      if (tracePathMode) {
        if (!pathStartNode) {
          setPathStartNode(node.id);
        } else {
          // Find path and highlight it
          setPathStartNode(null);
          setTracePathMode(false);
        }
      }

      const depNode = dependencyNodes.find((n) => n.id === node.id);
      if (onNodeSelect && depNode) {
        onNodeSelect(depNode);
      }

      // Focus camera on selected node
      if (fgRef.current && node) {
        const distance = 150;
        fgRef.current.cameraPosition(
          { x: node.x + distance, y: node.y + distance / 2, z: node.z + distance },
          node,
          1500
        );
      }
    },
    [tracePathMode, pathStartNode, onNodeSelect]
  );

  // Handle background click for deselection
  const handleBackgroundClick = useCallback(() => {
    if (onNodeSelect) {
      onNodeSelect(null);
    }

    // Return to full protocol view
    if (fgRef.current) {
      const distance = 400;
      fgRef.current.cameraPosition(
        { x: 0, y: 0, z: distance },
        { x: 0, y: 0, z: 0 },
        1500
      );
    }
  }, [onNodeSelect]);

  // Handle node double click
  const handleNodeDoubleClick = useCallback(
    (node: any) => {
      const depNode = dependencyNodes.find((n) => n.id === node.id);
      if (onNodeDoubleClick && depNode) {
        onNodeDoubleClick(node.id, depNode.sectionId);
      }
    },
    [onNodeDoubleClick]
  );

  // Node customization with text labels
  const nodeThreeObject = useCallback(
    (node: any) => {
      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredNodeId === node.id;
      const connected = selectedNodeId ? getConnectedNodes(selectedNodeId) : null;
      const isConnected = connected?.all.has(node.id);
      const isUpstream = connected?.upstream.has(node.id);
      const isDownstream = connected?.downstream.has(node.id);

      // Determine opacity
      let opacity = 1;
      if (selectedNodeId && !isConnected) {
        opacity = 0.15;
      }

      // Create group to hold sphere and label
      const group = new THREE.Group();

      // Create sphere for node
      const geometry = new THREE.SphereGeometry(isSelected ? 8 : isHovered ? 7 : 5);
      let color = node.color;

      // Color coding for impact analysis
      if (impactAnalysisMode && selectedNodeId) {
        if (node.id === selectedNodeId) {
          color = '#ffffff';
        } else if (isUpstream) {
          color = '#3b82f6'; // Blue for upstream
        } else if (isDownstream) {
          color = '#f59e0b'; // Amber for downstream
        }
      }

      const material = new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity,
        emissive: isSelected ? color : '#000000',
        emissiveIntensity: isSelected ? 0.5 : 0,
      });

      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);

      // Add status indicators as rings
      if (node.status && node.status.length > 0) {
        const ringGeometry = new THREE.TorusGeometry(7, 0.5, 8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: statusColors[node.status[0]],
          transparent: true,
          opacity,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        group.add(ring);
      }

      // Add text label
      const labelText = isSelected || cameraDistance < 200 ? node.name : node.abbreviatedName;
      const sprite = new SpriteText(labelText);
      sprite.color = isSelected ? '#ffffff' : opacity < 0.5 ? '#64748b' : '#e2e8f0';
      sprite.textHeight = isSelected ? 8 : 6;
      sprite.fontFace = 'SF Mono, Monaco, monospace';
      sprite.fontWeight = isSelected ? '600' : '400';
      sprite.position.y = 15;
      sprite.backgroundColor = 'rgba(15, 23, 42, 0.8)';
      sprite.padding = 3;
      sprite.borderRadius = 3;
      group.add(sprite);

      return group;
    },
    [selectedNodeId, hoveredNodeId, impactAnalysisMode, cameraDistance, getConnectedNodes]
  );

  // Link customization
  const linkColor = useCallback(
    (link: any) => {
      if (!selectedNodeId) return 'rgba(255,255,255,0.2)';

      const connected = getConnectedNodes(selectedNodeId);
      if (
        (link.source.id === selectedNodeId || link.target.id === selectedNodeId) ||
        (connected.all.has(link.source.id) && connected.all.has(link.target.id))
      ) {
        return 'rgba(255,255,255,0.8)';
      }

      return 'rgba(255,255,255,0.05)';
    },
    [selectedNodeId, getConnectedNodes]
  );

  const linkWidth = useCallback(
    (link: any) => {
      if (!selectedNodeId) return 1;

      if (link.source.id === selectedNodeId || link.target.id === selectedNodeId) {
        return 3;
      }

      return 0.5;
    },
    [selectedNodeId]
  );

  // Camera controls
  const handleHomeCamera = useCallback(() => {
    if (!fgRef.current) return;
    const distance = 400;
    fgRef.current.cameraPosition(
      { x: 0, y: 0, z: distance },
      { x: 0, y: 0, z: 0 },
      1500
    );
    setCameraDistance(distance);
    if (onNodeSelect) {
      onNodeSelect(null);
    }
  }, [onNodeSelect]);

  const handleClearSelection = useCallback(() => {
    if (onNodeSelect) {
      onNodeSelect(null);
    }
  }, [onNodeSelect]);

  const handleFitGraph = useCallback(() => {
    if (!fgRef.current) return;
    fgRef.current.zoomToFit(1500, 100);
  }, []);

  const handleFocusSelected = useCallback(() => {
    if (!selectedNodeId || !fgRef.current) return;

    const node = graphData.nodes.find((n) => n.id === selectedNodeId);
    if (node) {
      const distance = 150;
      fgRef.current.cameraPosition(
        { x: node.x + distance, y: node.y + distance / 2, z: node.z + distance },
        node,
        1500
      );
    }
  }, [selectedNodeId, graphData]);

  // Camera presets
  const applyCameraPreset = useCallback(
    (preset: string) => {
      if (!fgRef.current) return;

      const distance = 300;
      let position = { x: 0, y: 0, z: distance };

      switch (preset) {
        case 'clinical-design':
          position = { x: -100, y: 50, z: 200 };
          break;
        case 'study-operations':
          position = { x: 100, y: -50, z: 200 };
          break;
        case 'safety':
          position = { x: 0, y: -100, z: 200 };
          break;
        case 'statistics':
          position = { x: 0, y: 100, z: 200 };
          break;
        case 'protocol-structure':
          position = { x: -150, y: 0, z: 200 };
          break;
        case 'full-protocol':
          position = { x: 0, y: 0, z: 400 };
          break;
      }

      fgRef.current.cameraPosition(position, { x: 0, y: 0, z: 0 }, 1000);
      setCameraDistance(preset === 'full-protocol' ? 400 : 200);
    },
    []
  );

  // Apply camera preset when changed
  useEffect(() => {
    applyCameraPreset(cameraPreset);
  }, [cameraPreset, applyCameraPreset]);

  // Center on search result
  useEffect(() => {
    if (searchQuery && fgRef.current) {
      const matchingNode = graphData.nodes.find((n) =>
        n.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (matchingNode) {
        fgRef.current.centerAt(matchingNode.x, matchingNode.y, 1000);
        fgRef.current.zoom(8, 1000);
      }
    }
  }, [searchQuery, graphData]);

  return (
    <div className="h-full w-full relative">
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleHomeCamera}
          className="h-8 text-xs gap-1.5 font-mono"
          title="Reset camera to home position"
        >
          <Home className="h-3.5 w-3.5" />
          Home
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClearSelection}
          className="h-8 text-xs gap-1.5 font-mono"
          title="Clear current selection"
          disabled={!selectedNodeId}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleFitGraph}
          className="h-8 text-xs gap-1.5 font-mono"
          title="Fit entire graph to view"
        >
          <ZoomIn className="h-3.5 w-3.5" />
          Fit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleFocusSelected}
          className="h-8 text-xs gap-1.5 font-mono"
          title="Focus on selected node"
          disabled={!selectedNodeId}
        >
          <Focus className="h-3.5 w-3.5" />
          Focus
        </Button>
      </div>

      {/* Control Panel */}
      <div className="absolute top-20 left-4 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg space-y-2 max-w-xs">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={impactAnalysisMode ? 'default' : 'outline'}
              onClick={() => {
                setImpactAnalysisMode(!impactAnalysisMode);
                setTracePathMode(false);
              }}
              className="flex-1 h-8 text-xs gap-1"
            >
              <Target className="h-3 w-3" />
              Impact Analysis
            </Button>
            <Button
              size="sm"
              variant={tracePathMode ? 'default' : 'outline'}
              onClick={() => {
                setTracePathMode(!tracePathMode);
                setImpactAnalysisMode(false);
                setPathStartNode(null);
              }}
              className="flex-1 h-8 text-xs gap-1"
            >
              <GitBranch className="h-3 w-3" />
              Trace Path
            </Button>
          </div>

          <Select value={cameraPreset} onValueChange={setCameraPreset}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Camera View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-protocol">Full Protocol</SelectItem>
              <SelectItem value="clinical-design">Clinical Design</SelectItem>
              <SelectItem value="study-operations">Study Operations</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="statistics">Statistics</SelectItem>
              <SelectItem value="protocol-structure">Protocol Structure</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedNodeId && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs font-medium text-blue-400 mb-1">Current Selection</div>
            <div className="text-[10px] text-muted-foreground">
              {graphData.nodes.find((n) => n.id === selectedNodeId)?.name || 'Unknown'}
            </div>
            <div className="text-[9px] text-slate-500 mt-1">
              Click empty space to deselect
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <div className="text-xs font-medium mb-2">Navigation</div>
          <div className="text-[10px] text-muted-foreground space-y-1">
            <div>• Click node: Select & focus</div>
            <div>• Click space: Deselect & reset</div>
            <div>• Double-click: Open section</div>
            <div>• Drag: Rotate graph</div>
            <div>• Scroll: Zoom in/out</div>
            <div>• Right-click + drag: Pan view</div>
          </div>
        </div>

        {impactAnalysisMode && (
          <div className="pt-2 border-t border-border">
            <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30">
              Impact Analysis Active
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-1">
              Blue = Upstream | Amber = Downstream
            </p>
          </div>
        )}

        {tracePathMode && (
          <div className="pt-2 border-t border-border">
            <Badge variant="outline" className="text-xs text-purple-500 border-purple-500/30">
              Path Tracing Active
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-1">
              {pathStartNode ? 'Select end node' : 'Select start node'}
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <div className="text-xs font-medium mb-2">Status Legend</div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 ring-1 ring-green-500/20" />
              <span>Complete</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 ring-1 ring-amber-500/20" />
              <span>Incomplete</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 ring-1 ring-red-500/20" />
              <span>Issue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 ring-1 ring-blue-500/20" />
              <span>AI Rec</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="text-xs font-medium mb-2">Label Visibility</div>
          <div className="text-[10px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-slate-500" />
              <span>Far: Abbreviated</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              <span>Near: Full name</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400" />
              <span>Selected: Enhanced</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Status Indicator */}
      <div className="absolute bottom-4 right-4 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2">
        <div className="text-[10px] font-mono text-muted-foreground text-center space-y-1">
          <div className="flex items-center gap-2">
            <Maximize2 className="h-4 w-4 opacity-50" />
            <span className="font-semibold text-foreground">3D Graph</span>
          </div>
          {selectedNodeId ? (
            <div className="text-[9px] text-blue-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Focused View
            </div>
          ) : (
            <div className="text-[9px] text-green-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Full Protocol
            </div>
          )}
          <div className="text-[8px] text-slate-600 pt-1 border-t border-border mt-1">
            {graphData.nodes.length} nodes • {graphData.links.length} connections
          </div>
        </div>
      </div>

      {/* 3D Graph */}
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeLabel={(node: any) => `
          <div style="background: rgba(0,0,0,0.95); color: white; padding: 10px; border-radius: 6px; font-size: 12px; max-width: 220px; font-family: monospace; border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-weight: 600; margin-bottom: 6px; color: #e2e8f0;">${node.name}</div>
            <div style="font-size: 10px; color: #94a3b8; text-transform: capitalize; margin-bottom: 4px;">${node.type.replace('-', ' ')}</div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
              ${node.status.map((s: string) => `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${statusColors[s]}; margin-right: 4px;" title="${s.replace('-', ' ')}"></span>`).join('')}
            </div>
          </div>
        `}
        nodeThreeObject={nodeThreeObject}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeHover={(node) => setHoveredNodeId(node ? node.id : null)}
        onBackgroundClick={handleBackgroundClick}
        onZoom={(zoom: any) => {
          if (zoom && zoom.k) {
            setCameraDistance(400 / zoom.k);
          }
        }}
        backgroundColor="#0f172a"
        showNavInfo={false}
        enableNodeDrag={false}
      />
    </div>
  );
}
