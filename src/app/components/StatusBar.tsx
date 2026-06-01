// M11 Studio - Status Bar Component
import { Badge } from './ui/badge';
import { Users, FileText, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface StatusBarProps {
  protocolId: string;
  lastSaved?: Date;
  currentUser: string;
  totalSections: number;
  completedSections: number;
  validationIssues: number;
}

export function StatusBar({
  protocolId,
  lastSaved,
  currentUser,
  totalSections,
  completedSections,
  validationIssues,
}: StatusBarProps) {
  return (
    <div className="h-6 bg-card border-t border-border flex items-center px-4 text-xs text-muted-foreground gap-4">
      <div className="flex items-center gap-1.5">
        <FileText className="h-3 w-3" />
        <span>{protocolId}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Users className="h-3 w-3" />
        <span>{currentUser}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        <span>
          {completedSections}/{totalSections} sections complete
        </span>
      </div>

      {validationIssues > 0 && (
        <div className="flex items-center gap-1.5 text-red-500">
          <AlertCircle className="h-3 w-3" />
          <span>{validationIssues} validation issues</span>
        </div>
      )}

      <div className="flex-1" />

      {lastSaved && (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span>
            Last saved: {lastSaved.toLocaleTimeString()}
          </span>
        </div>
      )}

      <Badge variant="outline" className="h-4 text-[10px]">
        M11 v1.0
      </Badge>
    </div>
  );
}
