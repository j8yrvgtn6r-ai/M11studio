import { Sparkles } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { SoAConfigurationTabDefinition } from './soaConfigurationTabs';

interface SoAConfigurationPlaceholderTabProps {
  tab: SoAConfigurationTabDefinition;
}

export function SoAConfigurationPlaceholderTab({ tab }: SoAConfigurationPlaceholderTabProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{tab.label}</CardTitle>
            <CardDescription className="mt-1">{tab.description}</CardDescription>
          </div>
          {tab.planned ? (
            <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wide">
              Planned — Phase 3
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wide">
              Stage 2e — coming soon
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-3">
        {tab.planned ? (
          <>
            <p>
              Conditional Protocol Logic authoring is on the roadmap. This tab will surface decision rules,
              pathway visualization, and schedule branch impacts once the domain model is available.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Read-only explainer and backlog only in this release.</span>
            </div>
          </>
        ) : (
          <p>
            Configuration editors for {tab.label.toLowerCase()} will land in upcoming Stage 2e pull requests.
            The generated SoA matrix below continues to reflect the authoritative schedule cache.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
