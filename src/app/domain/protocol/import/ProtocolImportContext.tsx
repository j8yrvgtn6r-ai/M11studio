import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  getImportedProtocolSource,
  getProtocolImportReviewSummary,
  getProtocolImportState,
  initProtocolImportStore,
  subscribeProtocolImport,
} from './protocolImportStore';
import type { ImportedProtocolSource, ProtocolImportReviewSummary, ProtocolImportState } from './types';

interface ProtocolImportContextValue {
  ready: boolean;
  state: ProtocolImportState;
  importedSource: ImportedProtocolSource | null;
  summary: ProtocolImportReviewSummary;
  revision: number;
}

const ProtocolImportContext = createContext<ProtocolImportContextValue | null>(null);

export function ProtocolImportProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void initProtocolImportStore().then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    const unsubscribe = subscribeProtocolImport(() => {
      setRevision((value) => value + 1);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const state = useMemo(() => getProtocolImportState(), [revision]);
  const importedSource = useMemo(() => getImportedProtocolSource(), [revision, state.importedSourceSummary]);
  const summary = useMemo(() => getProtocolImportReviewSummary(), [revision]);

  const value = useMemo(
    () => ({
      ready,
      state,
      importedSource,
      summary,
      revision,
    }),
    [ready, state, importedSource, summary, revision],
  );

  return <ProtocolImportContext.Provider value={value}>{children}</ProtocolImportContext.Provider>;
}

export function useProtocolImport(): ProtocolImportContextValue {
  const context = useContext(ProtocolImportContext);
  if (!context) {
    throw new Error('useProtocolImport must be used within ProtocolImportProvider');
  }
  return context;
}

export function useSectionImportDraft(sectionId: string | null) {
  const { state } = useProtocolImport();
  if (!sectionId) {
    return undefined;
  }
  return state.sectionDrafts[sectionId];
}
