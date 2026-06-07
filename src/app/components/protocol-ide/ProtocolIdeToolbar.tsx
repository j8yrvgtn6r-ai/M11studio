import {
  ImageIcon,
  Link2,
  List,
  ListOrdered,
  Play,
  Redo2,
  Replace,
  Search,
  Table2,
  Undo2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

export interface ProtocolIdeToolbarProps {
  onUndo?: () => void;
  onRedo?: () => void;
  onBulletedList?: () => void;
  onNumberedList?: () => void;
  onInsertTable?: () => void;
  onInsertLink?: () => void;
  onInsertImageReference?: () => void;
  onValidate?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  validateDisabled?: boolean;
  validateRunning?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function ProtocolIdeToolbar({
  onUndo,
  onRedo,
  onBulletedList,
  onNumberedList,
  onInsertTable,
  onInsertLink,
  onInsertImageReference,
  onValidate,
  onFind,
  onReplace,
  validateDisabled = false,
  validateRunning = false,
  className,
  'data-testid': dataTestId = 'protocol-ide-toolbar',
}: ProtocolIdeToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-muted/30 px-1 py-0.5 font-mono text-foreground',
        className,
      )}
      data-testid={dataTestId}
    >
      <ToolbarButton label="Undo" onClick={onUndo} testId="toolbar-undo" icon={<Undo2 className="h-3.5 w-3.5" />} />
      <ToolbarButton label="Redo" onClick={onRedo} testId="toolbar-redo" icon={<Redo2 className="h-3.5 w-3.5" />} />
      <ToolbarDivider />
      <ToolbarButton label="Bulleted list" onClick={onBulletedList} testId="toolbar-bullet-list" icon={<List className="h-3.5 w-3.5" />} />
      <ToolbarButton label="Numbered list" onClick={onNumberedList} testId="toolbar-numbered-list" icon={<ListOrdered className="h-3.5 w-3.5" />} />
      <ToolbarDivider />
      <ToolbarButton label="Table" onClick={onInsertTable} testId="toolbar-insert-table" icon={<Table2 className="h-3.5 w-3.5" />} />
      <ToolbarButton label="Link" onClick={onInsertLink} testId="toolbar-insert-link" icon={<Link2 className="h-3.5 w-3.5" />} />
      <ToolbarButton label="Image Ref" onClick={onInsertImageReference} testId="toolbar-insert-image-ref" icon={<ImageIcon className="h-3.5 w-3.5" />} />
      <ToolbarDivider />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-7 px-2 font-mono text-[11px]"
        onClick={onValidate}
        disabled={validateDisabled || validateRunning || !onValidate}
        data-testid="toolbar-validate-section"
      >
        <Play className="h-3.5 w-3.5 mr-1" />
        {validateRunning ? 'Validating…' : 'Validate Section'}
      </Button>
      <ToolbarDivider />
      <ToolbarButton label="Find" onClick={onFind} testId="toolbar-find" icon={<Search className="h-3.5 w-3.5" />} />
      <ToolbarButton label="Replace" onClick={onReplace} testId="toolbar-replace" icon={<Replace className="h-3.5 w-3.5" />} />
    </div>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-4 w-px bg-border" aria-hidden />;
}

function ToolbarButton({
  label,
  onClick,
  testId,
  icon,
}: {
  label: string;
  onClick?: () => void;
  testId: string;
  icon: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 font-mono text-[11px]"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      data-testid={testId}
    >
      {icon}
      <span className="ml-1 hidden md:inline">{label}</span>
    </Button>
  );
}
