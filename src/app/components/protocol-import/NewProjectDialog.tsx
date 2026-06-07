import { useState } from 'react';

import { resetProject } from '../../domain/protocol/import/projectReset';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectReset?: () => void;
}

export function NewProjectDialog({ open, onOpenChange, onProjectReset }: NewProjectDialogProps) {
  const [resetting, setResetting] = useState(false);

  const handleCreate = async () => {
    setResetting(true);
    try {
      await resetProject();
      onProjectReset?.();
      onOpenChange(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="new-project-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Create a new project?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>This will remove:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>imported protocol</li>
                <li>generated sections</li>
                <li>study model</li>
                <li>knowledge graph</li>
                <li>validation history</li>
                <li>agent history</li>
              </ul>
              <p className="font-medium text-foreground">This action cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              data-testid="new-project-confirm"
              disabled={resetting}
              onClick={() => void handleCreate()}
            >
              {resetting ? 'Creating…' : 'Create New Project'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
