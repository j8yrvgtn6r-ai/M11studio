import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import type { GeneratedSectionDraft } from '../../domain/protocol/import';
import { Badge } from '../ui/badge';

interface GenerationMetadataPanelProps {
  draft: GeneratedSectionDraft;
}

export function GenerationMetadataPanel({ draft }: GenerationMetadataPanelProps) {
  const [open, setOpen] = useState(false);
  const p = draft.provenance ?? {
    generationProvider: draft.generationProvider ?? 'fixture',
    generationModel: 'unknown',
    generationTimestamp: draft.generatedAt ?? new Date().toISOString(),
    generationPromptVersion: 'unknown',
    sourceUploadId: draft.sourceUploadId,
    knowledgeModelId: draft.knowledgeModelId ?? '',
    sourceCandidateIds: draft.matchedSourceCandidateIds ?? [],
    confidence: 0.5,
    generationNotes: [],
    knowledgeElementsUsed: [],
    draftVersion: draft.draftVersion ?? 1,
  };

  return (
    <div className="rounded-lg border border-border bg-muted/10" data-testid="generation-metadata-panel">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm"
        onClick={() => setOpen((value) => !value)}
        data-testid="generation-metadata-toggle"
      >
        <span className="font-medium">Generation provenance</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open ? (
        <div className="px-3 pb-3 text-xs space-y-2 border-t border-border/60 pt-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" data-testid="generation-provider-badge">
              {p.generationProvider}
            </Badge>
            <Badge variant="secondary" data-testid="generation-model-badge">
              {p.generationModel}
            </Badge>
            <Badge variant="outline">v{p.draftVersion}</Badge>
            <Badge variant="outline">{Math.round(p.confidence * 100)}% confidence</Badge>
          </div>
          <p data-testid="generation-timestamp">
            Generated {new Date(p.generationTimestamp).toLocaleString()} · prompt {p.generationPromptVersion}
          </p>
          {(p.knowledgeElementsUsed ?? []).length > 0 ? (
            <div data-testid="knowledge-elements-used">
              <p className="font-medium mb-1">Knowledge elements used</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {(p.knowledgeElementsUsed ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {(p.sourceCandidateIds ?? []).length > 0 ? (
            <p data-testid="referenced-source-sections">
              Referenced source sections: {p.sourceCandidateIds.join(', ')}
            </p>
          ) : null}
          {(p.generationNotes ?? []).map((note) => (
            <p key={note} className="text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      ) : (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          <Badge variant="outline" data-testid="generation-provider-badge">
            {p.generationProvider}
          </Badge>
          <Badge variant="secondary" data-testid="generation-model-badge">
            {p.generationModel}
          </Badge>
        </div>
      )}
    </div>
  );
}
