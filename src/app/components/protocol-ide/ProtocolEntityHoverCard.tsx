import { GitBranch, Layers, Link2 } from 'lucide-react';
import type { ProtocolEntityHoverInfo } from '../../domain/protocol/entities';

export function ProtocolEntityHoverCard({
  hover,
  anchor,
}: {
  hover: ProtocolEntityHoverInfo;
  anchor: { top: number; left: number };
}) {
  return (
    <div
      className="absolute z-20 max-w-sm rounded-md border border-border bg-popover p-3 text-xs shadow-md pointer-events-none"
      style={{ top: anchor.top, left: anchor.left }}
      data-testid="protocol-entity-hover-card"
    >
      <p className="font-medium text-foreground">{hover.entity.name}</p>
      <p className="text-muted-foreground mt-0.5">
        Type: <span className="capitalize">{hover.entity.type.replace(/([A-Z])/g, ' $1')}</span>
      </p>
      {hover.entity.description ? (
        <p className="mt-1 text-muted-foreground line-clamp-3">{hover.entity.description}</p>
      ) : null}

      {hover.referencedInSections.length > 0 ? (
        <div className="mt-2">
          <p className="font-semibold text-muted-foreground">Referenced in:</p>
          <p>{hover.referencedInSections.join(', ')}</p>
        </div>
      ) : null}

      {hover.relationships.length > 0 ? (
        <div className="mt-2 space-y-1">
          <p className="font-semibold text-muted-foreground">Relationships:</p>
          {hover.relationships.slice(0, 4).map((relationship) => (
            <p key={`${relationship.entityId}-${relationship.label}`} className="flex items-start gap-1">
              <Link2 className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
              <span>
                {relationship.label}: {relationship.entityName}
              </span>
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-2 grid gap-1 text-muted-foreground">
        {hover.usedBySections.length > 0 ? (
          <p className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            Used by: Section {hover.usedBySections.join(', ')}
          </p>
        ) : null}
        {hover.downstreamSectionCount > 0 ? (
          <p className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            Impacts: {hover.downstreamSectionCount} downstream section
            {hover.downstreamSectionCount === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
