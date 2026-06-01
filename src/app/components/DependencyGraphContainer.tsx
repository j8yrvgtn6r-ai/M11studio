import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Search, Box, Network as NetworkIcon } from 'lucide-react';
import { DependencyGraphNodeEditor } from './DependencyGraphNodeEditor';
import { DependencyGraph3D } from './DependencyGraph3D';
import type { DependencyNode } from '../types/dependencyGraph';

interface DependencyGraphContainerProps {
  onNodeDoubleClick?: (nodeId: string, sectionId?: string) => void;
  onNodeSelect?: (node: DependencyNode | null) => void;
}

export function DependencyGraphContainer({ onNodeDoubleClick, onNodeSelect }: DependencyGraphContainerProps) {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<DependencyNode | null>(null);

  const handleNodeSelect = (node: DependencyNode | null) => {
    setSelectedNode(node);
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* View Selector and Search Bar */}
      <div className="h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as '2d' | '3d')}>
          <TabsList className="h-9">
            <TabsTrigger value="2d" className="text-xs gap-1.5">
              <NetworkIcon className="h-3.5 w-3.5" />
              2D Graph
            </TabsTrigger>
            <TabsTrigger value="3d" className="text-xs gap-1.5">
              <Box className="h-3.5 w-3.5" />
              3D Graph
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Graph View */}
      <div className="flex-1 overflow-hidden">
        {viewMode === '2d' ? (
          <DependencyGraphNodeEditor
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeSelect={handleNodeSelect}
          />
        ) : (
          <DependencyGraph3D
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNode?.id || null}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
}
