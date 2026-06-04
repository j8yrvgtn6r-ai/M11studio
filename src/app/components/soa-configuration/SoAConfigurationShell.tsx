import { useEffect, useMemo, useState } from 'react';

import { AlertTriangle, Sparkles } from 'lucide-react';

import {
  getProtocolDocument,
  getSchedule,
  isAuthoritativeScheduleCacheStale,
  subscribe,
} from '../../domain/protocol';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { formatGeneratedAt } from './formatGeneratedAt';
import { GeneratedSoAMatrix } from './GeneratedSoAMatrix';
import { SoAConfigurationAssessmentsTab } from './SoAConfigurationAssessmentsTab';
import { SoAConfigurationOverviewTab } from './SoAConfigurationOverviewTab';
import { SoAConfigurationPlaceholderTab } from './SoAConfigurationPlaceholderTab';
import { SoAConfigurationVisitsTab } from './SoAConfigurationVisitsTab';
import { SOA_CONFIGURATION_TABS } from './soaConfigurationTabs';

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

  useEffect(() => {
    return subscribe(() => {
      setProtocolRevision((revision) => revision + 1);
    });
  }, []);

  const document = useMemo(() => getProtocolDocument(), [protocolRevision]);
  const scheduleMetadata = useMemo(() => getSchedule().metadata, [protocolRevision]);
  const cacheStale = useMemo(() => isAuthoritativeScheduleCacheStale(), [protocolRevision]);

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              SoA Configuration
            </p>
            <h2 className="font-semibold truncate">1.3 Schedule of Activities</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {document.id} • {document.title}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs">
              {formatLifecycleStatus(document.metadata.lifecycleStatus)}
            </Badge>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {scheduleMetadata?.generatedFromRules ? (
                <Badge variant="outline" className="text-[10px]">
                  Generated cache
                  {scheduleMetadata.generatedAt
                    ? ` • ${formatGeneratedAt(scheduleMetadata.generatedAt)}`
                    : ''}
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">
                  Cache metadata missing
                </Badge>
              )}
              {cacheStale ? (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Stale
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col flex-1 min-h-0">
        <Tabs defaultValue="overview" orientation="vertical" className="flex flex-col flex-1 min-h-0 gap-0">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <TabsList className="flex flex-col h-full w-44 shrink-0 rounded-none border-r border-border bg-muted/20 p-2 gap-1 justify-start items-stretch">
              {SOA_CONFIGURATION_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="justify-start text-xs px-2 py-2 h-auto whitespace-normal text-left data-[state=active]:shadow-none"
                >
                  <span className="flex items-center gap-1.5 w-full">
                    <span className="flex-1">{tab.label}</span>
                    {tab.planned ? (
                      <Sparkles className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />
                    ) : null}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                {SOA_CONFIGURATION_TABS.map((tab) => (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0 outline-none">
                    {tab.id === 'overview' ? (
                      <SoAConfigurationOverviewTab />
                    ) : tab.id === 'soa-assessments' ? (
                      <SoAConfigurationAssessmentsTab />
                    ) : tab.id === 'visits' ? (
                      <SoAConfigurationVisitsTab />
                    ) : (
                      <SoAConfigurationPlaceholderTab tab={tab} />
                    )}
                  </TabsContent>
                ))}
              </div>
            </ScrollArea>
          </div>
        </Tabs>

        <section className="shrink-0 border-t border-border h-[42%] min-h-[220px] max-h-[480px]">
          <GeneratedSoAMatrix onCellClick={onCellClick} />
        </section>
      </div>
    </div>
  );
}
