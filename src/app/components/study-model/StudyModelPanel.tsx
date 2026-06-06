import { BrainCircuit } from 'lucide-react';

import {
  getStudyModelCollectionLabel,
  getStudyModelCollectionsForSection,
  matchStudyModelSectionFocus,
} from '../../domain/study-model/studyModelSelectors';
import { useStudyModel } from '../../domain/study-model/useStudyModel';
import type { StudyModelCollectionKey, StudyModelPhase } from '../../domain/study-model/studyModelTypes';
import { ScrollArea } from '../ui/scroll-area';

interface StudyModelPanelProps {
  sectionId: string | null;
  sectionTitle?: string | null;
}

function CollectionBlock({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; name: string; description?: string }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-border/70 bg-card/40 p-2">
            <p className="text-sm font-medium">{item.name}</p>
            {item.description ? (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{item.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StudyModelPanel({ sectionId, sectionTitle }: StudyModelPanelProps) {
  const { model, dependencies, phase } = useStudyModel();
  const focus = matchStudyModelSectionFocus(model, sectionId, sectionTitle ?? null);

  if (!model) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-card border-l border-border" data-testid="study-model-panel">
        <Header phase={phase} />
        <ScrollArea className="flex-1 min-h-0" data-testid="study-model-scroll">
          <div className="p-4 text-sm text-muted-foreground">
            Core Study Model will appear shortly after DOCX extraction during import.
          </div>
        </ScrollArea>
      </div>
    );
  }

  const sectionCollections = getStudyModelCollectionsForSection(model, sectionId);
  const focusedKey = focus && focus !== 'overview' ? (focus as StudyModelCollectionKey) : null;
  const focusedItems = focusedKey ? model[focusedKey] : [];

  return (
    <div className="flex flex-col h-full min-h-0 bg-card border-l border-border" data-testid="study-model-panel">
      <Header phase={phase} subtitle={model.studyMetadata.title ?? 'Structured study understanding'} />
      <ScrollArea className="flex-1 min-h-0" data-testid="study-model-scroll">
        <div className="p-4 space-y-4">
          {sectionId ? (
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Selected section</p>
              <p className="text-sm font-medium mt-1">{sectionTitle ?? sectionId}</p>
            </div>
          ) : null}

          {focusedKey && focusedItems.length > 0 ? (
            <CollectionBlock label={getStudyModelCollectionLabel(focusedKey)} items={focusedItems} />
          ) : null}

          {sectionCollections.length > 0 ? (
            sectionCollections.map((collection) => (
              <CollectionBlock key={collection.key} label={collection.label} items={collection.items} />
            ))
          ) : focusedItems.length === 0 ? (
            <OverviewBlock model={model} focus={focus} />
          ) : null}

          {sectionId ? (
            <div className="rounded-md border border-border/70 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Linked dependencies
              </p>
              {dependencies.filter((dependency) => dependency.protocolSectionId === sectionId).length > 0 ? (
                <ul className="text-xs space-y-1">
                  {dependencies
                    .filter((dependency) => dependency.protocolSectionId === sectionId)
                    .map((dependency) => (
                      <li key={dependency.id}>
                        {dependency.kind}: {dependency.label ?? dependency.studyModelItemId}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No structured dependencies mapped for this section yet.</p>
              )}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function Header({ subtitle, phase }: { subtitle?: string; phase?: StudyModelPhase }) {
  const phaseLabel =
    phase === 'enriching'
      ? 'Deep Study Model updating…'
      : phase === 'deep'
        ? 'Deep Study Model'
        : phase === 'core'
          ? 'Core Study Model'
          : 'Study Model';

  return (
    <div className="px-4 py-3 border-b border-border shrink-0">
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">Study Model</h2>
          {subtitle ? <p className="text-xs text-muted-foreground truncate">{subtitle}</p> : null}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2" data-testid="study-model-phase-label">
        {phaseLabel}
      </p>
    </div>
  );
}

function OverviewBlock({
  model,
  focus,
}: {
  model: NonNullable<ReturnType<typeof useStudyModel>['model']>;
  focus: ReturnType<typeof matchStudyModelSectionFocus>;
}) {
  if (focus === 'population') {
    return <CollectionBlock label="Population" items={model.population} />;
  }
  if (focus === 'assessments') {
    return (
      <div className="grid grid-cols-1 gap-3">
        <CollectionBlock label="Visits" items={model.visits} />
        <CollectionBlock label="Activities" items={model.activities} />
        <CollectionBlock label="Assessments" items={model.assessments} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CollectionBlock label="Primary Objectives" items={model.objectives} />
      <CollectionBlock label="Arms" items={model.arms} />
      <CollectionBlock label="Endpoints" items={model.endpoints} />
    </div>
  );
}
