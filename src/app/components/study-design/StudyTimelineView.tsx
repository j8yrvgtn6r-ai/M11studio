import { useMemo } from 'react';

import { getStudyDesign, subscribeStudyDesign } from '../../domain/study-design/StudyDesignStore';
import { useEffect, useState } from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export function StudyTimelineView() {
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribeStudyDesign(() => setRevision((value) => value + 1)), []);

  const model = useMemo(() => {
    void revision;
    return getStudyDesign();
  }, [revision]);

  if (!model || (model.epochs.length === 0 && model.visits.length === 0 && model.milestones.length === 0)) {
    return (
      <Card data-testid="study-timeline-empty">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Add epochs, visits, and milestones to preview the study timeline.
        </CardContent>
      </Card>
    );
  }

  const epochs = model.epochs.length > 0 ? model.epochs : [{ id: 'default-epoch', name: 'Study Timeline' }];

  return (
    <Card data-testid="study-timeline-view">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Study Timeline</CardTitle>
        <CardDescription>Read-only horizontal view of epochs, visits, and milestones.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {epochs.map((epoch) => {
            const epochVisits = model.visits.filter((visit) => !visit.epochId || visit.epochId === epoch.id);
            const epochMilestones = model.milestones.filter(
              (milestone) =>
                milestone.anchorVisitId &&
                epochVisits.some((visit) => visit.id === milestone.anchorVisitId),
            );
            return (
              <div
                key={epoch.id}
                className="min-w-[220px] rounded-lg border border-border bg-muted/20 p-3 space-y-3"
                data-testid={`study-timeline-epoch-${epoch.id}`}
              >
                <div className="font-medium text-sm">{epoch.name}</div>
                <div className="space-y-2">
                  {epochVisits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No visits</p>
                  ) : (
                    epochVisits.map((visit) => (
                      <div key={visit.id} className="rounded border border-border/70 bg-background px-2 py-1.5 text-xs">
                        <div className="font-medium">{visit.name}</div>
                        <div className="text-muted-foreground mt-0.5">
                          {visit.nominalDay != null
                            ? `Day ${visit.nominalDay}`
                            : visit.nominalWeek != null
                              ? `Week ${visit.nominalWeek}`
                              : visit.scheduleAnchorId
                                ? `Anchor +${visit.offsetDays ?? 0}d`
                                : visit.visitClass}
                        </div>
                        {(visit.windowBefore != null || visit.windowAfter != null) && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            -{visit.windowBefore ?? 0}/+{visit.windowAfter ?? 0} {visit.windowUnit ?? 'days'}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {epochMilestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300"
                    data-testid={`study-timeline-milestone-${milestone.id}`}
                  >
                    <span className="inline-block h-2 w-2 rotate-45 bg-amber-500" />
                    {milestone.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {model.milestones.filter((milestone) => !milestone.anchorVisitId).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {model.milestones
              .filter((milestone) => !milestone.anchorVisitId)
              .map((milestone) => (
                <Badge key={milestone.id} variant="secondary" className="text-[10px]">
                  ◆ {milestone.name}
                </Badge>
              ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
