import type { ScheduleAnchor, VisitDefinition } from '../../domain/protocol/types';

export function formatDisplayLabel(visit: VisitDefinition): string {
  return visit.displayLabel?.trim() || visit.name;
}

export function formatVisitOffsets(visit: VisitDefinition): string {
  const parts: string[] = [];
  if (visit.offsetDays !== undefined) {
    parts.push(`${visit.offsetDays >= 0 ? '+' : ''}${visit.offsetDays}d`);
  }
  if (visit.offsetWeeks !== undefined) {
    parts.push(`${visit.offsetWeeks >= 0 ? '+' : ''}${visit.offsetWeeks}w`);
  }
  if (visit.offsetCycles !== undefined) {
    parts.push(`${visit.offsetCycles >= 0 ? '+' : ''}${visit.offsetCycles}c`);
  }
  return parts.length > 0 ? parts.join(', ') : '—';
}

export function formatNominalTiming(visit: VisitDefinition): string {
  const parts: string[] = [];
  if (visit.nominalDay !== undefined) {
    parts.push(`Day ${visit.nominalDay}`);
  }
  if (visit.nominalWeek !== undefined) {
    parts.push(`Week ${visit.nominalWeek}`);
  }
  return parts.length > 0 ? parts.join(' • ') : '—';
}

export function formatVisitWindow(visit: VisitDefinition): string {
  const before = visit.windowBeforeDays;
  const after = visit.windowAfterDays;
  if (before === undefined && after === undefined) {
    return '—';
  }
  return `−${before ?? 0} / +${after ?? 0} days`;
}

export function formatPolicyLabel(value: string | undefined): string {
  if (!value) {
    return '—';
  }
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

export function resolveAnchorLabel(anchor: ScheduleAnchor | undefined, anchorId: string): string {
  if (!anchor) {
    return anchorId;
  }
  return anchor.name;
}

export function formatAnchorSummary(anchor: ScheduleAnchor): string {
  const parts = [anchor.anchorType.replace(/-/g, ' ')];
  if (anchor.sourceVisitId) {
    parts.push(`← ${anchor.sourceVisitId}`);
  }
  return parts.join(' • ');
}
