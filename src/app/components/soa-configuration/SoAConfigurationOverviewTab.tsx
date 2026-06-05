import { useMemo } from 'react';

import {
  getAssessmentScheduleRules,
  getProtocolDocument,
  getSchedule,
  getSoAAssessmentDefinitions,
  getValidationIssues,
  getVisitDefinitions,
  getVisits,
  getAssessments,
  isAuthoritativeScheduleCacheStale,
} from '../../domain/protocol';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatGeneratedAt } from './formatGeneratedAt';

interface OverviewStat {
  label: string;
  value: string | number;
}

export function SoAConfigurationOverviewTab() {
  const document = getProtocolDocument();
  const scheduleMetadata = getSchedule().metadata;
  const validationIssues = getValidationIssues();
  const scheduleIssueCount = validationIssues.filter((issue) => {
    const ruleId = issue.ruleId ?? '';
    return (
      issue.sectionId === '1.3' ||
      ruleId.includes('schedule') ||
      ruleId.includes('visit') ||
      ruleId.includes('soa')
    );
  }).length;

  const uniqueEpochCount = useMemo(() => {
    const epochs = new Set(
      getVisitDefinitions()
        .map((visit) => visit.epoch)
        .filter((epoch): epoch is string => Boolean(epoch)),
    );
    return epochs.size;
  }, []);

  const stats: OverviewStat[] = [
    { label: 'Study arms', value: document.clinicalDesign.studyArms.length },
    { label: 'Epochs (from visits)', value: uniqueEpochCount },
    { label: 'Visit definitions', value: getVisitDefinitions().length },
    { label: 'Clinical activities', value: document.clinicalDesign.assessments.length },
    { label: 'Assessments', value: getSoAAssessmentDefinitions().length },
    { label: 'Schedule rules', value: getAssessmentScheduleRules().length },
    { label: 'Generated visits', value: getVisits().length },
    { label: 'Generated assessments', value: getAssessments().length },
  ];

  const cacheStale = isAuthoritativeScheduleCacheStale();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration overview</CardTitle>
          <CardDescription>
            Live counts from the protocol store. Editors for each area will appear in the tab rail as Stage 2e
            progresses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-muted/20 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated schedule cache</CardTitle>
            <CardDescription>Authoritative output from assessment schedule rules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {scheduleMetadata?.generatedFromRules ? (
                <Badge variant="outline">Generated from rules</Badge>
              ) : (
                <Badge variant="destructive">Missing generation metadata</Badge>
              )}
              {cacheStale ? (
                <Badge variant="destructive">Stale — sources changed</Badge>
              ) : (
                <Badge variant="secondary">Up to date</Badge>
              )}
            </div>
            {scheduleMetadata?.generatedAt ? (
              <p className="text-muted-foreground">
                Last generated: {formatGeneratedAt(scheduleMetadata.generatedAt)}
              </p>
            ) : null}
            {scheduleMetadata?.sourceHash ? (
              <p className="text-xs font-mono text-muted-foreground break-all">
                sourceHash: {scheduleMetadata.sourceHash}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule validation</CardTitle>
            <CardDescription>Open issues tied to schedule configuration sources.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {scheduleIssueCount === 0 ? (
              <p>No schedule-related validation issues in the current snapshot.</p>
            ) : (
              <p>
                {scheduleIssueCount} schedule-related validation issue
                {scheduleIssueCount === 1 ? '' : 's'} detected. Full validation integration arrives in a later
                Stage 2e PR.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
