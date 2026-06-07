import { useEffect, useMemo, useState } from 'react';

import { AlertTriangle, GitCompareArrows } from 'lucide-react';

import {
  getProtocolDocument,
  getSchedule,
  isAuthoritativeScheduleCacheStale,
  subscribe,
} from '../../domain/protocol';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { formatGeneratedAt } from './formatGeneratedAt';
import { isSoAConfigurationEmpty } from './soaConfigurationEmpty';
import { SoAConfigurationAssessmentsTab } from './SoAConfigurationAssessmentsTab';
import { SoAConfigurationMatrixTab } from './SoAConfigurationMatrixTab';
import { SoAConfigurationPlaceholderTab } from './SoAConfigurationPlaceholderTab';
import { SoAConfigurationVisitsTab } from './SoAConfigurationVisitsTab';
import { SoAProposalActions } from '../soa-knowledge/SoAProposalReviewPanel';
import { SoAEnrichmentActions } from '../soa-knowledge/SoAEnrichmentProposalReviewPanel';
import { CHANGE_CONTROL_PLACEHOLDER, SOA_CONFIGURATION_TABS } from './soaConfigurationTabs';

interface SoAConfigurationShellProps {
  onCellClick: (visitId: string, assessmentId: string) => void;
}

function formatLifecycleStatus(status: string | undefined): string {
  if (!status) {
    return 'Unknown';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function SoAConfigurationShell({ onCellClick }: SoAConfigurationShellProps) {
  const [protocolRevision, setProtocolRevision] = useState(0);
  const [changeControlOpen, setChangeControlOpen] = useState(false);

  useEffect(() => {
    return subscribe(() => {
      setProtocolRevision((revision) => revision + 1);
    });
  }, []);

  const document = useMemo(() => getProtocolDocument(), [protocolRevision]);
  const scheduleMetadata = useMemo(() => getSchedule().metadata, [protocolRevision]);
  const cacheStale = useMemo(() => isAuthoritativeScheduleCacheStale(), [protocolRevision]);
  const lifecycleLabel = formatLifecycleStatus(document.metadata.lifecycleStatus);
  const soaEmpty = useMemo(() => isSoAConfigurationEmpty(document), [document]);

  function renderTabContent(tab: (typeof SOA_CONFIGURATION_TABS)[number]) {
    switch (tab.id) {
      case 'soa-assessments':
        return <SoAConfigurationAssessmentsTab />;
      case 'visits':
        return <SoAConfigurationVisitsTab />;
      case 'matrix':
        return <SoAConfigurationMatrixTab onCellClick={onCellClick} />;
      default:
        return <SoAConfigurationPlaceholderTab tab={tab} />;
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-4 py-3 border-b border-border bg-card shrink-0 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              SoA Configuration
            </p>
            <h2 className="text-lg font-semibold truncate leading-tight">
              {document.title?.trim() ? document.title : 'Untitled protocol'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {document.id?.trim() ? document.id : 'No protocol ID'}
              {document.schemaVersion ? ` • Schema ${document.schemaVersion}` : ''}
              {document.metadata.lifecycleStatus ? ` • ${lifecycleLabel}` : ''}
              {document.metadata.authoringMode ? ` • ${document.metadata.authoringMode}` : ''}
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">Section 1.3 Schedule of Activities</p>
            <div className="mt-2 space-y-2">
              <SoAProposalActions compact />
              <SoAEnrichmentActions compact />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setChangeControlOpen(true)}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Change Control
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {document.metadata.lifecycleStatus ? (
                <Badge variant="outline" className="text-[10px]">
                  {lifecycleLabel}
                </Badge>
              ) : null}
              {!soaEmpty && scheduleMetadata?.generatedFromRules ? (
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                  Cache
                  {scheduleMetadata.generatedAt
                    ? ` ${formatGeneratedAt(scheduleMetadata.generatedAt)}`
                    : ''}
                </Badge>
              ) : !soaEmpty ? (
                <Badge variant="destructive" className="text-[10px]">
                  Cache missing
                </Badge>
              ) : null}
              {!soaEmpty && cacheStale ? (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Stale
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="epochs" className="flex flex-col flex-1 min-h-0 gap-0">
        <div className="shrink-0 border-b border-border bg-muted/10 px-4 overflow-x-auto">
          <TabsList className="h-10 w-max min-w-full justify-start rounded-none bg-transparent p-0 gap-0">
            {SOA_CONFIGURATION_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-4 h-full min-h-0">
            {soaEmpty ? (
              <div
                className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 px-6 text-center"
                data-testid="soa-configuration-empty-state"
              >
                <p className="max-w-md text-sm text-muted-foreground">
                  No SoA has been created yet. Generate a first-pass SoA or add schedule items manually.
                </p>
              </div>
            ) : (
              SOA_CONFIGURATION_TABS.map((tab) => (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="mt-0 outline-none h-full min-h-0 data-[state=inactive]:hidden"
                >
                  {renderTabContent(tab)}
                </TabsContent>
              ))
            )}
          </div>
        </div>
      </Tabs>

      <Dialog open={changeControlOpen} onOpenChange={setChangeControlOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{CHANGE_CONTROL_PLACEHOLDER.title}</DialogTitle>
            <DialogDescription>{CHANGE_CONTROL_PLACEHOLDER.description}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Use the Matrix and Assessments tabs to validate schedule changes until amendment comparison ships.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
