import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eraser,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ScrollText,
  Square,
} from 'lucide-react';

import { formatBuildClockTime } from '../domain/protocol/build/formatBuildDuration';
import { formatEstimatedRemaining } from '../domain/protocol/import/llm/m11GenerationProgress';
import {
  clearProtocolBuildEvents,
  type ProtocolBuildEvent,
  type ProtocolBuildEventType,
} from '../domain/protocol/build/protocolBuildConsoleStore';
import { useProtocolBuildConsole } from '../domain/protocol/build/useProtocolBuildConsole';
import { GenerationProgressSummary } from './GenerationProgressSummary';
import { Button } from './ui/button';
import { cn } from './ui/utils';

function eventTypeClass(type: ProtocolBuildEventType): string {
  switch (type) {
    case 'success':
      return 'text-green-600 dark:text-green-400';
    case 'warning':
      return 'text-amber-600 dark:text-amber-400';
    case 'error':
      return 'text-destructive';
    case 'progress':
      return 'text-primary';
    default:
      return 'text-foreground/90';
  }
}

function BuildEventLine({ event }: { event: ProtocolBuildEvent }) {
  return (
    <div className="font-mono text-[11px] leading-5 whitespace-pre-wrap break-words" data-testid="protocol-build-event">
      <span className="text-muted-foreground">[{formatBuildClockTime(event.timestamp)}]</span>{' '}
      <span className={eventTypeClass(event.type)}>{event.message}</span>
    </div>
  );
}

function resolveActivePhase(build: ReturnType<typeof useProtocolBuildConsole>): string {
  if (build.status === 'paused') {
    return 'Paused';
  }
  if (build.visualizationPhase === 'reset') {
    return 'Resetting protocol state';
  }
  if (build.generationProgress?.currentSectionTitle) {
    return `Generating ${build.generationProgress.currentSectionTitle}`;
  }
  if (build.status === 'running') {
    return 'Reconstructing protocol';
  }
  if (build.status === 'complete') {
    return 'Reconstruction complete';
  }
  return 'Waiting';
}

export function ProtocolBuildConsole() {
  const build = useProtocolBuildConsole();
  const [expanded, setExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const latestEvent = build.events[build.events.length - 1];
  const isActive = build.status === 'running' || build.status === 'paused';
  const showConsole = build.status !== 'idle' || build.events.length > 0;
  const phaseLabel = resolveActivePhase(build);
  const completed = build.generationProgress?.completedSections ?? build.completionSummary?.sectionsGenerated ?? 0;
  const total = build.generationProgress?.totalSections ?? completed;
  const etaLabel = build.generationProgress
    ? formatEstimatedRemaining(build.generationProgress)
    : 'Estimating…';

  useEffect(() => {
    if (!expanded || !autoScroll || !scrollRef.current) {
      return;
    }
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [build.events.length, expanded, autoScroll]);

  useEffect(() => {
    if (build.status === 'running' || build.status === 'paused') {
      setExpanded(true);
    }
    if (build.status === 'complete' || build.status === 'cancelled' || build.status === 'failed') {
      setExpanded(false);
    }
  }, [build.status]);

  const summaryLine = useMemo(() => {
    if (build.status === 'paused') {
      return `${phaseLabel} · ${completed}/${total || '—'} · Resume to continue`;
    }
    if (build.status === 'complete' && build.completionSummary) {
      return `Completed · ${build.completionSummary.sectionsGenerated} generated · ${build.completionSummary.sectionsFailed} failed`;
    }
    if (isActive) {
      return `${phaseLabel} · ${completed}/${total || '—'} · ${etaLabel}`;
    }
    if (build.generationProgress) {
      const progress = build.generationProgress;
      return `${progress.completedSections}/${progress.totalSections} complete${
        progress.currentSectionTitle ? ` · ${progress.currentSectionTitle}` : ''
      }`;
    }
    return latestEvent?.message ?? 'Waiting for build activity…';
  }, [build.completionSummary, build.generationProgress, build.status, completed, etaLabel, isActive, latestEvent?.message, phaseLabel, total]);

  if (!showConsole) {
    return null;
  }

  return (
    <div
      className={cn(
        'border-t border-border bg-card shrink-0 transition-[height] duration-200',
        expanded ? 'h-[220px]' : 'h-10',
      )}
      data-testid="protocol-build-console"
      data-expanded={expanded ? 'true' : 'false'}
      data-status={build.status}
    >
      <div className="h-10 px-3 flex items-center gap-2 border-b border-border/60">
        {isActive ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" data-testid="protocol-build-spinner" />
        ) : (
          <ScrollText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate" data-testid="protocol-reconstruction-progress-title">
            {isActive || build.status === 'complete' ? 'Protocol Reconstruction Progress' : 'Protocol Build Console'}
          </p>
          <p className="text-[10px] text-muted-foreground truncate" data-testid="protocol-build-console-summary">
            {summaryLine}
          </p>
        </div>

        {isActive ? (
          <div
            className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground shrink-0"
            data-testid="protocol-build-inline-progress"
          >
            <span data-testid="import-generation-completed-count">
              {completed}/{total || '—'}
            </span>
            <span>·</span>
            <span data-testid="protocol-build-phase">{phaseLabel}</span>
            <span>·</span>
            <span data-testid="protocol-build-estimated-remaining-inline">{etaLabel}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-1 shrink-0">
          {isActive ? (
            <>
              {build.status === 'paused' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2"
                  data-testid="protocol-build-resume"
                  onClick={() => build.controls.resume?.()}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Resume
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2"
                  data-testid="protocol-build-pause"
                  onClick={() => build.controls.pauseAfterCurrent?.()}
                >
                  <Pause className="h-3 w-3 mr-1" />
                  Pause After Current Section
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] px-2"
                data-testid="protocol-build-cancel"
                onClick={() => build.controls.cancel?.()}
              >
                <Square className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </>
          ) : null}

          {build.status === 'complete' && build.failedSectionIds.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-[10px] px-2"
              data-testid="protocol-build-retry-failed"
              onClick={() => build.controls.retryFailed?.()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry Failed Sections
            </Button>
          ) : null}

          {expanded ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] px-2"
              data-testid="protocol-build-auto-scroll"
              onClick={() => setAutoScroll((value) => !value)}
            >
              Auto-scroll {autoScroll ? 'On' : 'Off'}
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            data-testid="protocol-build-clear"
            onClick={() => clearProtocolBuildEvents()}
            title="Clear console"
          >
            <Eraser className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            data-testid="protocol-build-toggle"
            onClick={() => setExpanded((value) => !value)}
            title={expanded ? 'Collapse console' : 'Expand console'}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="h-[180px] flex flex-col min-h-0">
          {(isActive || build.status === 'complete') ? (
            <div className="px-3 pt-2 shrink-0 max-h-[88px] overflow-hidden">
              <GenerationProgressSummary
                progress={build.generationProgress}
                status={build.status}
                mode={build.mode}
              />
            </div>
          ) : null}

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1">
            {build.events.map((event) => (
              <BuildEventLine key={event.id} event={event} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
