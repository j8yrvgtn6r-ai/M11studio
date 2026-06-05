import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export function SoAConfigurationScheduleRulesPlaceholder() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Schedule rules</CardTitle>
        <CardDescription>
          Assessment × visit intersections from <span className="font-mono">assessmentScheduleRules</span> drive the
          Matrix projection.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>
          Rule authoring will live here. For now, use the read-only Schedule sub-tab to inspect visits and open the
          Matrix tab to preview generated cells.
        </p>
        <p className="text-xs">
          Future work will align rule editing with the execution model (activity-scoped placements). See{' '}
          <span className="font-mono">EXECUTION_MODEL_GAP_ANALYSIS.md</span>.
        </p>
      </CardContent>
    </Card>
  );
}
