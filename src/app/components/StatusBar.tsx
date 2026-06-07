// M11 Studio - Status Bar Component
import { Badge } from './ui/badge';
import { FileText, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export type AutosaveStatus = 'idle' | 'saving' | 'saved';

interface StatusBarProps {
  protocolId: string;
  autosaveStatus?: AutosaveStatus;
  lastSaved?: Date | null;
  totalSections: number;
  completedSections: number;
}

export function StatusBar({
  protocolId,
  autosaveStatus = 'idle',
  lastSaved,
  totalSections,
  completedSections,
}: StatusBarProps) {
  const autosaveLabel =
    autosaveStatus === 'saving'
      ? 'Saving…'
      : lastSaved
        ? `Autosaved ${format(lastSaved, 'h:mm a')}`
        : autosaveStatus === 'saved'
          ? 'Autosaved'
          : '';

  return (
    <div className="h-6 bg-card border-t border-border flex items-center px-4 text-xs text-muted-foreground gap-4 shrink-0">
      <div className="flex items-center gap-1.5" data-testid="footer-protocol-identity">
        <FileText className="h-3 w-3" />
        <span>{protocolId}</span>
      </div>

      <div className="flex items-center gap-1.5" data-testid="footer-section-completion">
        <CheckCircle2 className="h-3 w-3" />
        <span>
          {completedSections}/{totalSections} sections complete
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5" data-testid="autosave-status" data-autosave-state={autosaveStatus}>
        {autosaveStatus === 'saving' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        <span>{autosaveLabel}</span>
      </div>

      <Badge variant="outline" className="h-4 text-[10px]">
        M11 v1.0
      </Badge>
    </div>
  );
}
