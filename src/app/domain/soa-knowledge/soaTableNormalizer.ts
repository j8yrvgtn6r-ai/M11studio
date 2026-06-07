const SCHEDULE_HEADING_PATTERNS = [
  /\bschedule of activities\b/i,
  /\bschedule of assessments\b/i,
  /\bstudy calendar\b/i,
  /\bvisit schedule\b/i,
  /\bassessments and procedures\b/i,
  /\bschedule of study procedures\b/i,
];

const VISIT_LABEL_PATTERNS = [
  /\bscreening\b/i,
  /\bbaseline\b/i,
  /\bcycle\s*\d+/i,
  /\bday\s*\d+/i,
  /\bweek\s*\d+/i,
  /\bvisit\b/i,
  /\beot\b/i,
  /\bend of treatment\b/i,
  /\bfollow[- ]?up\b/i,
  /\bevery\s+\d+\s+(weeks?|days?|months?|cycles?)\b/i,
];

const ASSESSMENT_LABEL_PATTERNS = [
  /\bvital signs?\b/i,
  /\bphysical exam/i,
  /\becg\b/i,
  /\bhematology\b/i,
  /\bchemistry\b/i,
  /\bimaging\b/i,
  /\btumor imaging\b/i,
  /\badverse events?\b/i,
  /\bcon(?:comitant)? meds?\b/i,
  /\blabs?\b/i,
  /\bpk sampling\b/i,
];

const MARKER_REQUIRED = /^(x|✓|√|yes|y|required|\*|●|■)$/i;
const MARKER_OPTIONAL = /^(optional|o)$/i;
const CONDITION_TEXT = /if clinically indicated|as clinically indicated|when clinically indicated|per investigator/i;
const RECURRING_COLUMN = /\bevery\s+(\d+)\s+(weeks?|days?|months?|cycles?)\b/i;

export function isScheduleHeading(text: string): boolean {
  return SCHEDULE_HEADING_PATTERNS.some((pattern) => pattern.test(text));
}

export function scoreVisitLabel(text: string): number {
  if (!text.trim()) return 0;
  let score = 0;
  for (const pattern of VISIT_LABEL_PATTERNS) {
    if (pattern.test(text)) score += 1;
  }
  return score;
}

export function scoreAssessmentLabel(text: string): number {
  if (!text.trim()) return 0;
  let score = 0;
  for (const pattern of ASSESSMENT_LABEL_PATTERNS) {
    if (pattern.test(text)) score += 1;
  }
  return score;
}

export function normalizeTableCell(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeTableGrid(rawCells: string[][]): {
  normalizedCells: string[][];
  diagnostics: string[];
} {
  const diagnostics: string[] = [];
  if (rawCells.length === 0) {
    return { normalizedCells: [], diagnostics: ['Empty table grid.'] };
  }

  const maxCols = Math.max(...rawCells.map((row) => row.length), 0);
  const normalizedCells = rawCells.map((row) => {
    const cells = row.map((cell) => normalizeTableCell(cell));
    while (cells.length < maxCols) {
      cells.push('');
    }
    return cells;
  });

  diagnostics.push('Merged cell structure not available; normalized best effort.');

  // Collapse repeated header rows when consecutive rows are identical non-empty labels.
  const deduped: string[][] = [];
  for (const row of normalizedCells) {
    const signature = row.join('|').toLowerCase();
    const previous = deduped[deduped.length - 1];
    if (previous && previous.join('|').toLowerCase() === signature && signature.replace(/\|/g, '').length > 0) {
      diagnostics.push('Repeated header row collapsed during normalization.');
      continue;
    }
    deduped.push(row);
  }

  return { normalizedCells: deduped, diagnostics };
}

export function classifyCellMarker(cellText: string): {
  required: boolean;
  optional: boolean;
  condition?: string;
  ambiguous: boolean;
} {
  const text = normalizeTableCell(cellText);
  if (!text) {
    return { required: false, optional: false, ambiguous: false };
  }
  if (CONDITION_TEXT.test(text)) {
    return { required: false, optional: true, condition: text, ambiguous: false };
  }
  if (MARKER_REQUIRED.test(text)) {
    return { required: true, optional: false, ambiguous: false };
  }
  if (MARKER_OPTIONAL.test(text)) {
    return { required: false, optional: true, ambiguous: false };
  }
  if (/^[x✓√]$/i.test(text)) {
    return { required: true, optional: false, ambiguous: false };
  }
  if (text.length <= 3 && /[?~]/.test(text)) {
    return { required: false, optional: false, ambiguous: true };
  }
  return { required: false, optional: false, ambiguous: Boolean(text) };
}

export function inferTableRole(headingContext: string[], normalizedCells: string[][]): {
  role: import('./soaTableExtractionTypes').SoATableRole;
  confidenceReason: string;
} {
  const headingHaystack = headingContext.join(' ').toLowerCase();
  if (/\bschedule of activities\b/.test(headingHaystack)) {
    return { role: 'scheduleOfActivities', confidenceReason: 'Heading matches Schedule of Activities.' };
  }
  if (/\bschedule of assessments\b/.test(headingHaystack) || /\bassessments and procedures\b/.test(headingHaystack)) {
    return { role: 'assessmentSchedule', confidenceReason: 'Heading matches assessment schedule.' };
  }
  if (/\bvisit schedule\b/.test(headingHaystack) || /\bstudy calendar\b/.test(headingHaystack)) {
    return { role: 'visitSchedule', confidenceReason: 'Heading matches visit schedule.' };
  }
  if (/\blaboratory\b/.test(headingHaystack)) {
    return { role: 'laboratorySchedule', confidenceReason: 'Heading references laboratory schedule.' };
  }
  if (/\bsafety\b/.test(headingHaystack)) {
    return { role: 'safetySchedule', confidenceReason: 'Heading references safety schedule.' };
  }

  const flat = normalizedCells.flat().join(' ').toLowerCase();
  const visitScore = VISIT_LABEL_PATTERNS.filter((p) => p.test(flat)).length;
  const assessmentScore = ASSESSMENT_LABEL_PATTERNS.filter((p) => p.test(flat)).length;
  const markerScore = normalizedCells.flat().filter((cell) => MARKER_REQUIRED.test(cell)).length;

  if (visitScore >= 2 && assessmentScore >= 2 && markerScore >= 2) {
    return {
      role: 'scheduleOfActivities',
      confidenceReason: 'Grid contains visit columns, assessment rows, and schedule markers.',
    };
  }
  if (visitScore >= 2 && assessmentScore >= 1) {
    return { role: 'visitSchedule', confidenceReason: 'Grid contains visit-like columns.' };
  }
  if (assessmentScore >= 2) {
    return { role: 'assessmentSchedule', confidenceReason: 'Grid contains assessment-like row labels.' };
  }

  return { role: 'unknown', confidenceReason: 'Insufficient schedule signals in table grid.' };
}

export function parseRecurringVisitLabel(label: string): { name: string; window?: string } {
  const match = RECURRING_COLUMN.exec(label);
  if (!match) {
    return { name: label.trim() };
  }
  return { name: `Every ${match[1]} ${match[2]}`, window: match[0] };
}

export function slugTableEntity(prefix: string, value: string): string {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}`;
}
