import { SoAConfigurationShell } from './soa-configuration/SoAConfigurationShell';

interface ScheduleOfActivitiesProps {
  onCellClick: (visitId: string, assessmentId: string) => void;
}

/** Section 1.3 — SoA Configuration workspace with read-only generated matrix preview. */
export function ScheduleOfActivities({ onCellClick }: ScheduleOfActivitiesProps) {
  return <SoAConfigurationShell onCellClick={onCellClick} />;
}
