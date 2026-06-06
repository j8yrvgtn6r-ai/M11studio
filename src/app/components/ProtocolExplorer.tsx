import { ChevronRight, ChevronDown, FileText, AlertCircle, MessageSquare, FileEdit, BookOpen, BrainCircuit } from 'lucide-react';
import { useState } from 'react';
import type { GeneratedSectionDraft } from '../domain/protocol/import';
import {
  resolveSectionGenerationState,
  type ImportVisualizationPhase,
  type SectionGenerationState,
} from '../domain/protocol/build/protocolBuildConsoleStore';
import {
  SectionGenerationStateIndicator,
  sectionGenerationStateLabel,
} from './SectionGenerationStateIndicator';
import type { ProtocolSection } from '../types/protocol';
import { getStatusColor } from '../utils/statusColors';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

interface ProtocolExplorerProps {
  sections: ProtocolSection[];
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  templateReferenceEnabled: boolean;
  onTemplateReferenceChange: (enabled: boolean) => void;
  studyModelEnabled: boolean;
  onStudyModelChange: (enabled: boolean) => void;
  sectionImportDrafts?: Record<string, GeneratedSectionDraft>;
  sectionGenerationStates?: Record<string, SectionGenerationState>;
  buildActive?: boolean;
  visualizationPhase?: ImportVisualizationPhase;
  generationProgress?: {
    providerLabel?: string;
    model?: string;
    currentRequestDurationMs?: number;
  } | null;
}

export function ProtocolExplorer({
  sections,
  selectedSectionId,
  onSelectSection,
  templateReferenceEnabled,
  onTemplateReferenceChange,
  studyModelEnabled,
  onStudyModelChange,
  sectionImportDrafts = {},
  sectionGenerationStates = {},
  buildActive = false,
  visualizationPhase = 'idle',
  generationProgress = null,
}: ProtocolExplorerProps) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-sidebar border-r border-sidebar-border" data-testid="protocol-explorer-panel">
      <div className="px-3 py-2 border-b border-sidebar-border space-y-2 shrink-0">
        <div>
          <h2 className="font-semibold text-sm text-sidebar-foreground">Protocol Explorer</h2>
          <p className="text-xs text-muted-foreground mt-0.5">PROTO-XYZ-301</p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md border border-sidebar-border bg-card/40 px-2 py-1.5">
          <Label htmlFor="m11-template-reference-toggle" className="text-xs flex items-center gap-1.5 cursor-pointer">
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            Template Reference
          </Label>
          <Switch
            id="m11-template-reference-toggle"
            checked={templateReferenceEnabled}
            onCheckedChange={onTemplateReferenceChange}
            aria-label="Toggle M11 Template Reference"
          />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md border border-sidebar-border bg-card/40 px-2 py-1.5">
          <Label htmlFor="study-model-toggle" className="text-xs flex items-center gap-1.5 cursor-pointer">
            <BrainCircuit className="h-3.5 w-3.5 shrink-0" />
            Study Model
          </Label>
          <Switch
            id="study-model-toggle"
            checked={studyModelEnabled}
            onCheckedChange={onStudyModelChange}
            aria-label="Toggle Study Model panel"
            data-testid="study-model-toggle"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0" data-testid="protocol-explorer-scroll">
        <div className="p-2">
          {sections.map((section) => (
            <SectionTreeNode
              key={section.id}
              section={section}
              selectedSectionId={selectedSectionId}
              onSelectSection={onSelectSection}
              sectionImportDrafts={sectionImportDrafts}
              sectionGenerationStates={sectionGenerationStates}
              buildActive={buildActive}
              visualizationPhase={visualizationPhase}
              generationProgress={generationProgress}
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
  sectionImportDrafts,
  sectionGenerationStates,
  buildActive,
  visualizationPhase,
  generationProgress,
}: {
  section: ProtocolSection;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  sectionImportDrafts: Record<string, GeneratedSectionDraft>;
  sectionGenerationStates: Record<string, SectionGenerationState>;
  buildActive: boolean;
  visualizationPhase: ImportVisualizationPhase;
  generationProgress: ProtocolExplorerProps['generationProgress'];
}) {
  const importDraft = sectionImportDrafts[section.id];
  const generationState = resolveSectionGenerationState(
    section.id,
    sectionGenerationStates,
    importDraft,
    buildActive,
  );
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

        <span className={`flex-1 truncate ${section.ichM11InstructionOnly ? 'text-muted-foreground italic' : ''}`}>
          {section.title}
        </span>

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
          {(importDraft || buildActive || sectionGenerationStates[section.id]) ? (
            <div
              className="flex items-center"
              title={[
                section.title,
                `Generation: ${sectionGenerationStateLabel(generationState)}`,
                generationProgress?.providerLabel
                  ? `Provider: ${generationProgress.providerLabel}${generationProgress.model ? ` / ${generationProgress.model}` : ''}`
                  : null,
                importDraft?.generatedAt ? `Updated: ${new Date(importDraft.generatedAt).toLocaleString()}` : null,
                importDraft?.validationMessages?.[0] ? `Error: ${importDraft.validationMessages[0]}` : null,
              ]
                .filter(Boolean)
                .join('\n')}
              data-testid={`import-section-indicator-${section.id}`}
              data-generation-state={generationState}
            >
              <SectionGenerationStateIndicator state={generationState} compact />
            </div>
          ) : (
            <div className={`w-2 h-2 rounded-full ${statusColor.dot}`} title={section.status} />
          )}
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
              sectionImportDrafts={sectionImportDrafts}
              sectionGenerationStates={sectionGenerationStates}
              buildActive={buildActive}
              visualizationPhase={visualizationPhase}
              generationProgress={generationProgress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
