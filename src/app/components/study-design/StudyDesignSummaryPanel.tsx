import { useEffect, useMemo, useState } from 'react';

import { Layers } from 'lucide-react';

import {
  buildStudyDesignFromKnowledgeGraph,
  detectNarrativeChangesForStudyDesign,
  evaluateStudyDesignStudioState,
  getStudyDesignSummary,
  setStudyDesignSyncProposal,
  subscribeStudyDesign,
} from '../../domain/study-design';
import {
  getCurrentNarrativeImpactProposal,
  subscribeStudyDesignProposals,
} from '../../domain/study-design/studyDesignProposalStore';
import {
  evaluateUsdmExportReadiness,
  getUsdmReadinessLabel,
  subscribeUsdmExport,
} from '../../domain/usdm';
import { evaluateSoAFirstPassReadiness, firstPassSoAExists } from '../../domain/soa-knowledge/soaReadinessEvaluator';
import { subscribeSoAProposal } from '../../domain/soa-knowledge/soaProposalStore';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const DETECTION_LABELS = {
  knowledgeGraph: 'Knowledge Graph',
  protocolNarrative: 'Protocol Narrative',
  manualEntry: 'Manual Entry',
} as const;

function validationBadgeVariant(status: 'healthy' | 'warnings' | 'errors') {
  if (status === 'errors') return 'destructive' as const;
  if (status === 'warnings') return 'outline' as const;
  return 'secondary' as const;
}

function gradeBadgeVariant(grade: 'A' | 'B' | 'C' | 'D') {
  if (grade === 'A') return 'secondary' as const;
  if (grade === 'B') return 'outline' as const;
  return 'destructive' as const;
}

function usdmReadinessBadgeVariant(state: 'notReady' | 'readyWithWarnings' | 'ready') {
  if (state === 'ready') return 'secondary' as const;
  if (state === 'readyWithWarnings') return 'outline' as const;
  return 'destructive' as const;
}

export function StudyDesignSummaryPanel() {
  const [revision, setRevision] = useState(0);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    const unsubDesign = subscribeStudyDesign(bump);
    const unsubProposal = subscribeSoAProposal(bump);
    const unsubStudyProposals = subscribeStudyDesignProposals(bump);
    const unsubUsdm = subscribeUsdmExport(bump);
    return () => {
      unsubDesign();
      unsubProposal();
      unsubStudyProposals();
      unsubUsdm();
    };
  }, []);

  const summary = useMemo(() => {
    void revision;
    return getStudyDesignSummary();
  }, [revision]);

  const studioState = useMemo(() => {
    void revision;
    return evaluateStudyDesignStudioState(firstPassSoAExists());
  }, [revision]);

  const firstPassReady = useMemo(() => {
    void revision;
    return evaluateSoAFirstPassReadiness().ready;
  }, [revision]);

  const narrativeImpact = useMemo(() => {
    void revision;
    return getCurrentNarrativeImpactProposal();
  }, [revision]);

  const usdmReadiness = useMemo(() => {
    void revision;
    return evaluateUsdmExportReadiness();
  }, [revision]);

  async function handleBuildStudyDesign() {
    setBuilding(true);
    try {
      const narrativeProposal = detectNarrativeChangesForStudyDesign();
      if (narrativeProposal) {
        setStudyDesignSyncProposal(narrativeProposal);
      } else {
        const kgProposal = buildStudyDesignFromKnowledgeGraph();
        setStudyDesignSyncProposal(kgProposal);
      }
      setRevision((value) => value + 1);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5" data-testid="study-design-summary-panel">
      <CardHeader className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Study Design Status
            </CardTitle>
            {!summary.exists ? (
              <p className="text-xs text-muted-foreground" data-testid="study-design-missing-message">
                No study design has been detected yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {summary.detectionSources.map((source) => (
                  <Badge key={source} variant="outline" className="text-[10px]">
                    {DETECTION_LABELS[source] ?? source}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={validationBadgeVariant(summary.validationStatus)} className="text-[10px]">
              {summary.validationStatus === 'healthy' ? 'Healthy' : summary.validationStatus === 'warnings' ? 'Warnings' : 'Errors'}
            </Badge>
            {summary.exists ? (
              <Badge variant={gradeBadgeVariant(summary.healthScore.grade)} className="text-[10px]" data-testid="study-design-health-grade">
                Health {summary.healthScore.score} · Grade {summary.healthScore.grade}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        {summary.exists ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[11px]">
            {(
              [
                ['Arms', summary.counts.arms],
                ['Epochs', summary.counts.epochs],
                ['Visits', summary.counts.visits],
                ['Activities', summary.counts.activities],
                ['Milestones', summary.counts.milestones],
                ['Rules', summary.counts.scheduleRules],
              ] as const
            ).map(([label, count]) => (
              <div key={label} className="rounded border border-border/60 bg-background/80 px-2 py-1.5">
                <div className="font-medium">{count}</div>
                <div className="text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {summary.exists ? (
          <p className="text-[11px] text-muted-foreground">{summary.healthScore.summary}</p>
        ) : null}

        {summary.exists ? (
          <div
            className="rounded border border-border/60 bg-background/80 px-3 py-2 space-y-1.5"
            data-testid="usdm-readiness-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium">Schedule Export Readiness</p>
              <Badge variant={usdmReadinessBadgeVariant(usdmReadiness.state)} className="text-[10px]">
                {getUsdmReadinessLabel(usdmReadiness.state)}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">{usdmReadiness.message}</p>
            {usdmReadiness.missingFields.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Missing: {usdmReadiness.missingFields.join(', ')}
              </p>
            ) : null}
            {usdmReadiness.blockingErrors.length > 0 ? (
              <p className="text-[11px] text-destructive">
                {usdmReadiness.blockingErrors[0]}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <span>{usdmReadiness.counts.encounters} visits</span>
              <span>{usdmReadiness.counts.activities} activities</span>
              <span>{usdmReadiness.counts.scheduleInstances} schedule rows</span>
            </div>
          </div>
        ) : null}

        {narrativeImpact?.status === 'proposed' ? (
          <p className="text-[11px] text-amber-700 dark:text-amber-300" data-testid="study-design-narrative-impact-banner">
            Protocol narrative may need updating. Sections: {narrativeImpact.impactedSectionIds.join(', ')}.
          </p>
        ) : null}

        {studioState === 'noStudyDesign' ? (
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={building}
            onClick={() => void handleBuildStudyDesign()}
            data-testid="build-study-design-button"
          >
            {building ? 'Analyzing…' : 'Build Study Design'}
          </Button>
        ) : null}

        {studioState === 'studyDesignExists' && !firstPassReady ? (
          <p className="text-[11px] text-muted-foreground">
            Study Design is ready. Generate First-Pass SoA to derive the schedule matrix.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
