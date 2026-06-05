import { Download, ExternalLink } from 'lucide-react';

import { downloadProtocolSourceArtifact, openProtocolSourceArtifact } from '../../domain/protocol/import';
import { Button } from '../ui/button';

interface ImportProtocolSourceActionsProps {
  disabled?: boolean;
  variant?: 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'default';
}

export function ImportProtocolSourceActions({
  disabled = false,
  variant = 'outline',
  size = 'sm',
}: ImportProtocolSourceActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={variant}
        size={size}
        className="gap-1.5"
        disabled={disabled}
        data-testid="import-open-original-protocol"
        onClick={() => openProtocolSourceArtifact()}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open original protocol
      </Button>
      <Button
        variant={variant}
        size={size}
        className="gap-1.5"
        disabled={disabled}
        data-testid="import-download-original-protocol"
        onClick={() => downloadProtocolSourceArtifact()}
      >
        <Download className="h-3.5 w-3.5" />
        Download original
      </Button>
    </div>
  );
}
