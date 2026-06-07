import { useEffect, useMemo, useState } from 'react';
import type { ProtocolRegistryAsset } from '../../domain/protocol/assets/protocolAssetRegistry';
import { addAsset, listAssets } from '../../domain/protocol/assets/protocolAssetRegistry';
import { formatImageReferenceToken } from '../../domain/protocol/assets/protocolAssetReference';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export interface InsertImageReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (token: string, asset: ProtocolRegistryAsset) => void;
}

export function InsertImageReferenceDialog({
  open,
  onOpenChange,
  onInsert,
}: InsertImageReferenceDialogProps) {
  const [assets, setAssets] = useState<ProtocolRegistryAsset[]>(() => listAssets());
  const [selectedAssetId, setSelectedAssetId] = useState<string>('new');
  const [caption, setCaption] = useState('Study Design Overview');
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (open) {
      setAssets(listAssets());
    }
  }, [open]);

  const handleInsert = () => {
    const trimmedCaption = caption.trim();
    if (!trimmedCaption) {
      return;
    }

    let asset: ProtocolRegistryAsset;
    if (selectedAssetId !== 'new') {
      const existing = assets.find((entry) => entry.id === selectedAssetId);
      if (!existing) {
        return;
      }
      asset = existing;
    } else {
      asset = addAsset({
        type: 'figure',
        name: trimmedCaption,
        caption: trimmedCaption,
        url: url.trim() || undefined,
        storagePath: url.trim() ? url.trim() : `protocol-assets/${trimmedCaption.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        source: url.trim() ? 'url' : 'generated',
      });
    }

    onInsert(
      formatImageReferenceToken({
        id: asset.id,
        caption: asset.caption,
        type: 'figure',
        name: asset.name,
        storageLocation: asset.storagePath ?? '',
        createdAt: asset.createdAt,
      }),
      asset,
    );
    onOpenChange(false);
  };

  const selectedExisting = useMemo(
    () => assets.find((entry) => entry.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="insert-image-reference-dialog">
        <DialogHeader>
          <DialogTitle>Insert Image Reference</DialogTitle>
          <DialogDescription>
            Insert a Git-friendly figure token. No binary content is embedded in section text.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Asset</Label>
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger data-testid="insert-image-reference-asset-select">
                <SelectValue placeholder="Choose asset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create new reference</SelectItem>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.caption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="figure-caption">Caption</Label>
            <Input
              id="figure-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              data-testid="insert-image-reference-caption"
            />
          </div>

          {selectedAssetId === 'new' ? (
            <div className="space-y-1">
              <Label htmlFor="figure-url">URL or path (optional)</Label>
              <Input
                id="figure-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/figure.png"
                data-testid="insert-image-reference-url"
              />
            </div>
          ) : selectedExisting?.url ? (
            <p className="text-xs text-muted-foreground">Linked URL: {selectedExisting.url}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsert} data-testid="insert-image-reference-confirm">
              Insert Reference
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
