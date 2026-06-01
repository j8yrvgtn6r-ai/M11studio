import { ChevronRight, ChevronDown, FileText, AlertCircle, MessageSquare, FileEdit } from 'lucide-react';
import { useState } from 'react';
import type { ProtocolSection } from '../types/protocol';
import { getStatusColor } from '../utils/statusColors';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

interface ProtocolExplorerProps {
  sections: ProtocolSection[];
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
}

export function ProtocolExplorer({ sections, selectedSectionId, onSelectSection }: ProtocolExplorerProps) {
  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="px-3 py-2 border-b border-sidebar-border">
        <h2 className="font-semibold text-sm text-sidebar-foreground">Protocol Explorer</h2>
        <p className="text-xs text-muted-foreground mt-0.5">PROTO-XYZ-301</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {sections.map((section) => (
            <SectionTreeNode
              key={section.id}
              section={section}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function SectionTreeNode({
  section,
  selectedSectionId,
  onSelectSection,
}: {
  section: ProtocolSection;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = section.children && section.children.length > 0;
  const isSelected = selectedSectionId === section.id;
  const statusColor = getStatusColor(section.status);

  return (
    <div>
      <button
        onClick={() => onSelectSection(section.id)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
          isSelected
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
        }`}
        style={{ paddingLeft: `${section.level * 12 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="shrink-0 cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }
            }}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        ) : (
          <div className="w-3.5" />
        )}

        <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />

        <span className="flex-1 truncate">{section.title}</span>

        <div className="flex items-center gap-1 shrink-0">
          {section.hasAmendment && (
            <FileEdit className="h-3 w-3 text-orange-500" />
          )}
          {section.commentCount && section.commentCount > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-xs">
              <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
              {section.commentCount}
            </Badge>
          )}
          {section.validationCount && section.validationCount > 0 && (
            <Badge variant="outline" className={`h-4 px-1 text-xs ${statusColor.text}`}>
              <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
              {section.validationCount}
            </Badge>
          )}
          <div className={`w-2 h-2 rounded-full ${statusColor.dot}`} title={section.status} />
        </div>
      </button>

      {hasChildren && expanded && (
        <div>
          {section.children!.map((child) => (
            <SectionTreeNode
              key={child.id}
              section={child}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
            />
          ))}
        </div>
      )}
    </div>
  );
}
