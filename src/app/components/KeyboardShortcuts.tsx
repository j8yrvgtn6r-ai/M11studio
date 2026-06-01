import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Command, Search, Save, Download, HelpCircle } from 'lucide-react';

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  const shortcuts = [
    { key: '⌘K / Ctrl+K', description: 'Open command palette', icon: Command },
    { key: '⌘S / Ctrl+S', description: 'Save protocol', icon: Save },
    { key: '⌘E / Ctrl+E', description: 'Export protocol', icon: Download },
    { key: '⌘F / Ctrl+F', description: 'Search in document', icon: Search },
    { key: '⌘? / Ctrl+?', description: 'Show keyboard shortcuts', icon: HelpCircle },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Quick reference for M11 Studio shortcuts</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => {
            const Icon = shortcut.icon;
            return (
              <div key={index} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{shortcut.description}</span>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {shortcut.key}
                </Badge>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
