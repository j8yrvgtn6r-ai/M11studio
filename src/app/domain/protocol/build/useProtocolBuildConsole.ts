import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  getProtocolBuildConsoleState,
  subscribeProtocolBuildConsole,
  type ProtocolBuildConsoleState,
} from './protocolBuildConsoleStore';

export function useProtocolBuildConsole(): ProtocolBuildConsoleState {
  return useSyncExternalStore(subscribeProtocolBuildConsole, getProtocolBuildConsoleState, getProtocolBuildConsoleState);
}

export function useProtocolBuildConsoleRevision(): number {
  const [, setRevision] = useState(0);
  useEffect(() => subscribeProtocolBuildConsole(() => setRevision((value) => value + 1)), []);
  return 0;
}
