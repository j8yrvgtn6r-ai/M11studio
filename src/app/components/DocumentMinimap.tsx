import { MessageSquare, AlertCircle } from 'lucide-react';
import type { ProtocolSection } from '../types/protocol';
import { getStatusColor } from '../utils/statusColors';
import { ScrollArea } from './ui/scroll-area';

interface DocumentMinimapProps {
  sections: ProtocolSection[];
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
}

export function DocumentMinimap({ sections, selectedSectionId, onSelectSection }: DocumentMinimapProps) {
  const flattenSections = (sections: ProtocolSection[]): ProtocolSection[] => {
    const result: ProtocolSection[] = [];
    sections.forEach((section) => {
      result.push(section);
      if (section.children) {
        result.push(...flattenSections(section.children));
      }
    });
    return result;
  };

  const allSections = flattenSections(sections);

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-16">
      <div className="px-2 py-2 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground text-center">MAP</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-1">
          {allSections.map((section) => {
            const statusColor = getStatusColor(section.status);
            const isSelected = selectedSectionId === section.id;

            return (
              <button
                key={section.id}
                onClick={() => onSelectSection(section.id)}
                className={`w-full h-8 rounded flex items-center justify-center relative group transition-all ${
                  isSelected ? 'ring-2 ring-primary' : ''
                } ${statusColor.bg} hover:${statusColor.bg} hover:brightness-110`}
                title={section.title}
              >
                {/* Validation/Comment Indicators */}
                <div className="absolute inset-0 flex items-center justify-center gap-0.5">
                  {section.validationCount && section.validationCount > 0 && (
                    <AlertCircle className="h-2.5 w-2.5 text-red-500" />
                  )}
                  {section.commentCount && section.commentCount > 0 && (
                    <MessageSquare className="h-2.5 w-2.5 text-blue-500" />
                  )}
                </div>

                {/* Status bar on the left edge */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor.dot}`} />

                {/* Hover tooltip */}
                <div className="absolute right-full mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
                  {section.title}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
