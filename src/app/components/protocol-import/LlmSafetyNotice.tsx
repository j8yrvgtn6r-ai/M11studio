import { Alert, AlertDescription } from '../ui/alert';

export function LlmSafetyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <Alert
      variant="default"
      className={compact ? 'py-2 border-amber-500/30 bg-amber-500/5' : 'border-amber-500/30 bg-amber-500/5'}
      data-testid="llm-safety-notice"
    >
      <AlertDescription className="text-xs text-muted-foreground">
        Generated content is a proposal and requires human review. Live provider calls may send
        extracted protocol content to the configured model provider.
      </AlertDescription>
    </Alert>
  );
}
