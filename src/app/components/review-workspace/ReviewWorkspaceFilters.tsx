import type { ReviewItemSeverity, ReviewItemSource, ReviewItemStatus } from '../../domain/review-workspace/ReviewItemTypes';
import { REVIEW_ITEM_SOURCE_LABELS } from '../../domain/review-workspace/ReviewItemTypes';
import type { ReviewWorkspaceFiltersState } from '../../domain/review-workspace/ReviewItemTypes';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const ALL_SOURCES: ReviewItemSource[] = [
  'validation',
  'lint',
  'studyDesign',
  'narrativeSync',
  'soa',
  'soaEnrichment',
  'consistency',
  'usdm',
];

const ALL_SEVERITIES: ReviewItemSeverity[] = ['error', 'warning', 'info'];
const ALL_STATUSES: ReviewItemStatus[] = ['open', 'accepted', 'rejected', 'deferred'];

interface ReviewWorkspaceFiltersProps {
  filters: ReviewWorkspaceFiltersState;
  sections: string[];
  onChange: (filters: ReviewWorkspaceFiltersState) => void;
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

export function ReviewWorkspaceFiltersPanel({ filters, sections, onChange }: ReviewWorkspaceFiltersProps) {
  return (
    <div className="space-y-3 p-3 border-b border-border bg-muted/20" data-testid="review-workspace-filters">
      <Input
        placeholder="Search findings…"
        value={filters.searchText ?? ''}
        onChange={(event) => onChange({ ...filters, searchText: event.target.value })}
        className="h-8 text-xs"
        data-testid="review-workspace-search"
      />

      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Source</Label>
        <div className="flex flex-wrap gap-1">
          {ALL_SOURCES.map((source) => (
            <Badge
              key={source}
              variant={filters.sources.length === 0 || filters.sources.includes(source) ? 'secondary' : 'outline'}
              className="text-[10px] cursor-pointer"
              onClick={() =>
                onChange({
                  ...filters,
                  sources: toggleValue(filters.sources, source),
                })
              }
            >
              {REVIEW_ITEM_SOURCE_LABELS[source]}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Severity</Label>
          <div className="flex flex-wrap gap-1">
            {ALL_SEVERITIES.map((severity) => (
              <Badge
                key={severity}
                variant={filters.severities.length === 0 || filters.severities.includes(severity) ? 'secondary' : 'outline'}
                className="text-[10px] cursor-pointer"
                onClick={() =>
                  onChange({
                    ...filters,
                    severities: toggleValue(filters.severities, severity),
                  })
                }
              >
                {severity}
              </Badge>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
          <div className="flex flex-wrap gap-1">
            {ALL_STATUSES.map((status) => (
              <Badge
                key={status}
                variant={filters.statuses.includes(status) ? 'secondary' : 'outline'}
                className="text-[10px] cursor-pointer"
                onClick={() =>
                  onChange({
                    ...filters,
                    statuses: toggleValue(filters.statuses, status),
                  })
                }
              >
                {status}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Select
        value={filters.sectionId ?? '__all__'}
        onValueChange={(value) => onChange({ ...filters, sectionId: value === '__all__' ? undefined : value })}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Section" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All sections</SelectItem>
          {sections.map((sectionId) => (
            <SelectItem key={sectionId} value={sectionId}>
              Section {sectionId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
