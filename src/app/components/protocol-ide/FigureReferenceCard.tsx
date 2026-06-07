import { ImageIcon } from 'lucide-react';
import { findAssetByCaption, getAsset } from '../../domain/protocol/assets/protocolAssetRegistry';
import { parseImageReferenceToken } from '../../domain/protocol/assets/protocolAssetReference';
import { cn } from '../ui/utils';

export function FigureReferenceCard({
  token,
  className,
}: {
  token: string;
  className?: string;
}) {
  const parsed = parseImageReferenceToken(token);
  if (!parsed) {
    return null;
  }

  const asset = parsed.assetId ? getAsset(parsed.assetId) : findAssetByCaption(parsed.caption);
  const thumbnailUrl = asset?.url ?? (asset?.storagePath && /^https?:\/\//i.test(asset.storagePath) ? asset.storagePath : undefined);

  return (
    <figure
      className={cn(
        'my-3 overflow-hidden rounded-md border border-border bg-muted/20 p-3',
        className,
      )}
      data-testid="figure-reference-card"
      data-asset-id={asset?.id}
    >
      <div className="flex items-start gap-3">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={parsed.caption}
            className="h-16 w-24 rounded object-cover border border-border"
            data-testid="figure-reference-thumbnail"
          />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-border bg-background">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <figcaption className="text-sm">
          <p className="font-medium">{parsed.caption}</p>
          <p className="text-xs text-muted-foreground mt-1">Figure reference{asset?.id ? ` · ${asset.id}` : ''}</p>
        </figcaption>
      </div>
    </figure>
  );
}
