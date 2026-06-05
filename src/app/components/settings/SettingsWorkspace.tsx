import { BookOpen, ListTree, Settings } from 'lucide-react';

import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { IchM11ControlledTerminologyPanel } from './IchM11ControlledTerminologyPanel';
import { IchM11SettingsPanel } from './IchM11SettingsPanel';

export type SettingsView = 'ich-m11' | 'ich-m11-terminology';

interface SettingsWorkspaceProps {
  activeView: SettingsView;
  onViewChange: (view: SettingsView) => void;
  onClose: () => void;
}

export function SettingsWorkspace({ activeView, onViewChange, onClose }: SettingsWorkspaceProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Back to protocol
        </Button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <nav className="w-52 shrink-0 border-r border-border bg-muted/20 p-2 space-y-1">
          <Button
            variant={activeView === 'ich-m11' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2 text-sm"
            onClick={() => onViewChange('ich-m11')}
          >
            <BookOpen className="h-4 w-4" />
            ICH M11
          </Button>
          <Button
            variant={activeView === 'ich-m11-terminology' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2 text-sm"
            onClick={() => onViewChange('ich-m11-terminology')}
          >
            <ListTree className="h-4 w-4" />
            Controlled Terminology
          </Button>
        </nav>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {activeView === 'ich-m11' ? <IchM11SettingsPanel /> : null}
            {activeView === 'ich-m11-terminology' ? <IchM11ControlledTerminologyPanel /> : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
