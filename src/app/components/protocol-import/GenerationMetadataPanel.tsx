import { ChevronDown, ChevronRight } from 'lucide-react';

import { useState } from 'react';



import type { GeneratedSectionDraft } from '../../domain/protocol/import';

import { Badge } from '../ui/badge';



interface GenerationMetadataPanelProps {

  draft: GeneratedSectionDraft;

}



function providerLabel(providerId: string): string {

  switch (providerId) {

    case 'openai':

      return 'OpenAI';

    case 'azure-openai':

      return 'Azure OpenAI';

    case 'fixture':

    case 'local':

      return 'Simulation Mode';

    default:

      return providerId;

  }

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



  const providerName = providerLabel(p.generationProvider);



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



      <div className="px-3 pb-2 flex flex-wrap gap-2 items-center">

        <Badge variant="outline" data-testid="generation-provider-badge">

          {providerName}

        </Badge>

        <Badge variant="secondary" data-testid="generation-model-badge">

          {p.generationModel}

        </Badge>

        <Badge variant="outline" data-testid="generation-prompt-version-badge">

          {p.generationPromptVersion}

        </Badge>

        <Badge variant="outline">{Math.round(p.confidence * 100)}% confidence</Badge>

      </div>



      {open ? (

        <div className="px-3 pb-3 text-xs space-y-3 border-t border-border/60 pt-2">

          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">

            <dt className="text-muted-foreground">Provider</dt>

            <dd data-testid="generation-provenance-provider">{providerName}</dd>



            <dt className="text-muted-foreground">Model</dt>

            <dd className="font-mono" data-testid="generation-provenance-model">

              {p.generationModel}

            </dd>



            <dt className="text-muted-foreground">Prompt version</dt>

            <dd data-testid="generation-provenance-prompt-version">{p.generationPromptVersion}</dd>



            <dt className="text-muted-foreground">Timestamp</dt>

            <dd data-testid="generation-timestamp">

              {new Date(p.generationTimestamp).toLocaleString()}

            </dd>



            <dt className="text-muted-foreground">Confidence</dt>

            <dd data-testid="generation-provenance-confidence">{Math.round(p.confidence * 100)}%</dd>



            <dt className="text-muted-foreground">Draft version</dt>

            <dd>v{p.draftVersion}</dd>



            <dt className="text-muted-foreground">Source sections</dt>

            <dd data-testid="referenced-source-sections" className="font-mono break-all">

              {(p.sourceCandidateIds ?? []).length > 0

                ? p.sourceCandidateIds.join(', ')

                : 'None referenced'}

            </dd>

            {draft.contentOrigin === 'imported' ? (
              <>
                <dt className="text-muted-foreground">Source heading</dt>
                <dd data-testid="import-source-heading">{draft.sourceHeading ?? 'Unknown'}</dd>

                <dt className="text-muted-foreground">Mapping method</dt>
                <dd data-testid="import-mapping-method">{draft.mappingMethod ?? 'Unknown'}</dd>

                <dt className="text-muted-foreground">Imported length</dt>
                <dd data-testid="import-text-length">
                  {draft.importedTextLength ?? draft.sourceText?.length ?? 0} characters
                </dd>

                <dt className="text-muted-foreground">Source preview</dt>
                <dd data-testid="import-source-preview">
                  {draft.sourcePreview ?? draft.sourceText?.slice(0, 120) ?? 'None'}
                </dd>

                <dt className="text-muted-foreground">Source section id</dt>
                <dd className="font-mono" data-testid="import-source-section-id">
                  {draft.sourceSectionId ?? draft.matchedSourceCandidateIds?.[0] ?? 'Unknown'}
                </dd>
              </>
            ) : null}

          </dl>

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

          {(p.generationNotes ?? []).length > 0 ? (
            <div className="space-y-1">
              {p.generationNotes.map((note) => (
                <p key={note} className="text-muted-foreground">
                  {note}
                </p>
              ))}
            </div>
          ) : null}

        </div>

      ) : (

        <p className="px-3 pb-2 text-[11px] text-muted-foreground" data-testid="generation-timestamp-collapsed">

          Generated {new Date(p.generationTimestamp).toLocaleString()}

        </p>

      )}

    </div>

  );

}


