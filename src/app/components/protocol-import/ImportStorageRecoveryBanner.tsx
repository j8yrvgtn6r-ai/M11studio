import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface ImportStorageRecoveryBannerProps {
  warnings: string[];
  testId?: string;
}

export function ImportStorageRecoveryBanner({
  warnings,
  testId = 'import-storage-recovery-banner',
}: ImportStorageRecoveryBannerProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className="border-amber-500/40 bg-amber-500/5"
      data-testid={testId}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm">Import data recovered</AlertTitle>
      <AlertDescription className="text-xs space-y-1">
        {warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}
