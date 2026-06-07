export type ProtocolIdeShortcutAction =
  | 'toggle-protocol-search'
  | 'open-find'
  | 'open-replace'
  | 'force-save';

export interface ProtocolIdeShortcutEvent {
  metaKey?: boolean;
  ctrlKey?: boolean;
  key: string;
}

/** Maps Ctrl/Cmd shortcuts to Protocol IDE actions (undo/redo use native contentEditable). */
export function resolveProtocolIdeShortcut(
  event: ProtocolIdeShortcutEvent,
): ProtocolIdeShortcutAction | null {
  const mod = Boolean(event.metaKey || event.ctrlKey);
  if (!mod) {
    return null;
  }

  switch (event.key.toLowerCase()) {
    case 'k':
      return 'toggle-protocol-search';
    case 'f':
      return 'open-find';
    case 'h':
      return 'open-replace';
    case 's':
      return 'force-save';
    default:
      return null;
  }
}
