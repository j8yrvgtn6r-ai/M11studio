import React from 'react';
import { Handle, Position } from 'reactflow';
import { Badge } from '../ui/badge';
import type { NodeStatus } from '../../types/dependencyGraph';

const statusBorderColors: Record<NodeStatus, string> = {
  complete: '#10b981',
  incomplete: '#f59e0b',
  'validation-issue': '#ef4444',
  'ai-recommendation': '#3b82f6',
  'recently-modified': '#8b5cf6',
};

interface ProtocolNodeProps {
  data: {
    name: string;
    type: string;
    status: NodeStatus[];
    inputs: number;
    outputs: number;
    sectionId?: string;
  };
  selected?: boolean;
}

export function ProtocolNode({ data, selected }: ProtocolNodeProps) {
  const primaryStatus = data.status[0] || 'incomplete';
  const borderColor = statusBorderColors[primaryStatus];

  return (
    <div
      className="relative bg-slate-900/98 backdrop-blur-sm border rounded-sm shadow-xl min-w-[200px] transition-all duration-200"
      style={{
        borderColor: selected ? borderColor : '#334155',
        borderWidth: selected ? '2px' : '1px',
        boxShadow: selected
          ? `0 0 0 3px ${borderColor}30, 0 8px 16px rgba(0,0,0,0.4)`
          : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {/* Status Bar */}
      {selected && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: borderColor }}
        />
      )}

      {/* Input Handles */}
      {Array.from({ length: data.inputs }).map((_, i) => (
        <Handle
          key={`in-${i}`}
          type="target"
          position={Position.Left}
          id={`in-${i}`}
          style={{
            top: `${((i + 1) / (data.inputs + 1)) * 100}%`,
            width: 10,
            height: 10,
            background: '#475569',
            border: '2px solid #0f172a',
            borderRadius: '50%',
            left: -6,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      ))}

      {/* Node Content */}
      <div className="px-4 py-2.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
            {data.type.replace('-', ' ')}
          </div>
          {data.sectionId && (
            <div className="text-[9px] font-mono text-slate-600 px-1.5 py-0.5 bg-slate-800 rounded">
              {data.sectionId}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-xs font-mono text-slate-100 mb-2 leading-snug pr-2">
          {data.name}
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-1.5 mt-2">
          {data.status.map((status, idx) => (
            <div
              key={idx}
              className="w-2 h-2 rounded-full ring-1 ring-slate-700"
              style={{ backgroundColor: statusBorderColors[status] }}
              title={status.replace('-', ' ')}
            />
          ))}
        </div>
      </div>

      {/* Output Handles */}
      {Array.from({ length: data.outputs }).map((_, i) => (
        <Handle
          key={`out-${i}`}
          type="source"
          position={Position.Right}
          id={`out-${i}`}
          style={{
            top: `${((i + 1) / (data.outputs + 1)) * 100}%`,
            width: 10,
            height: 10,
            background: '#475569',
            border: '2px solid #0f172a',
            borderRadius: '50%',
            right: -6,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      ))}
    </div>
  );
}
