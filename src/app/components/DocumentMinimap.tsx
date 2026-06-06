import { Loader2 } from 'lucide-react';
import type { GeneratedSectionDraft } from '../domain/protocol/import';
import {
  getImportVisualizationPhase,
  resolveSectionGenerationState,
  type ImportVisualizationPhase,
  type SectionGenerationState,
} from '../domain/protocol/build/protocolBuildConsoleStore';
import type { ProtocolSection } from '../types/protocol';
import {
  sectionGenerationOverlayClass,
  sectionGenerationStateLabel,
  SectionGenerationStateIndicator,
  sectionGenerationDotClass,
} from './SectionGenerationStateIndicator';
import { formatBuildDurationMs } from '../domain/protocol/build/formatBuildDuration';
import { ScrollArea } from './ui/scroll-area';

interface DocumentMinimapProps {
  sections: ProtocolSection[];
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  sectionImportDrafts?: Record<string, GeneratedSectionDraft>;
  sectionGenerationStates?: Record<string, SectionGenerationState>;
  buildActive?: boolean;
  visualizationPhase?: ImportVisualizationPhase;
  generationProgress?: {
    providerLabel?: string;
    model?: string;
    currentRequestDurationMs?: number;
    currentSectionId?: string;
  } | null;
}

export function DocumentMinimap({
  sections,
  selectedSectionId,
  onSelectSection,
  sectionImportDrafts = {},
  sectionGenerationStates = {},
  buildActive = false,
  visualizationPhase = 'idle',
  generationProgress = null,
}: DocumentMinimapProps) {
  const flattenSections = (items: ProtocolSection[]): ProtocolSection[] => {
    const result: ProtocolSection[] = [];
    items.forEach((section) => {
      result.push(section);
      if (section.children) {
        result.push(...flattenSections(section.children));
      }
    });
    return result;
  };

  const allSections = flattenSections(sections);
  const phase = visualizationPhase === 'idle' ? getImportVisualizationPhase() : visualizationPhase;

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-16" data-testid="document-minimap">
      <div className="px-2 py-2 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground text-center">MAP</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-1">
          {allSections.map((section) => {
            const isSelected = selectedSectionId === section.id;
            const importDraft = sectionImportDrafts[section.id];
            const generationState = resolveSectionGenerationState(
              section.id,
              sectionGenerationStates,
              importDraft,
              buildActive,
            );
            const neutralImportTile =
              buildActive && (phase === 'reset' || (generationState === 'queued' && !importDraft));
            const overlayClass =
              buildActive || importDraft ? sectionGenerationOverlayClass(generationState) : '';
            const tileBackground = neutralImportTile
              ? 'bg-muted/80'
              : buildActive || importDraft
                ? sectionGenerationDotClass(generationState)
                : 'bg-muted/40';
            const tooltipLines = [
              `Section: ${section.title}`,
              `Status: ${sectionGenerationStateLabel(generationState)}`,
              generationProgress?.providerLabel
                ? `Provider: ${generationProgress.providerLabel}${generationProgress.model ? ` / ${generationProgress.model}` : ''}`
                : null,
              generationState === 'generating' && generationProgress?.currentRequestDurationMs !== undefined
                ? `Elapsed: ${formatBuildDurationMs(generationProgress.currentRequestDurationMs)}`
                : null,
              importDraft?.validationMessages?.[0] ? `Error: ${importDraft.validationMessages[0]}` : null,
            ].filter(Boolean);

            return (
              <button
                key={section.id}
                onClick={() => onSelectSection(section.id)}
                className={`w-full h-8 rounded flex items-center justify-center relative group transition-all ${
                  isSelected ? 'ring-2 ring-primary' : ''
                } ${tileBackground} hover:brightness-110 ${overlayClass}`}
                title={tooltipLines.join('\n')}
                data-testid={`map-section-${section.id}`}
                data-generation-state={generationState}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  {!neutralImportTile && generationState === 'generating' ? (
                    <Loader2 className="h-3 w-3 animate-spin text-primary-foreground" data-testid={`map-generating-${section.id}`} />
                  ) : !neutralImportTile && (buildActive || importDraft) && generationState !== 'queued' ? (
                    <SectionGenerationStateIndicator state={generationState} compact />
                  ) : null}
                </div>

                <div className="absolute right-full mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-pre-line z-10 transition-opacity max-w-[220px]">
                  {tooltipLines.join('\n')}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
