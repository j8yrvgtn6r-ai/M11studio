import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  getReferenceDocument,
  initReferenceDocumentService,
  subscribeReferenceDocuments,
} from './referenceDocumentService';
import type { ReferenceDocument, ReferenceDocumentId } from './types';

interface ReferenceDocumentContextValue {
  ready: boolean;
  getDocument: (id: ReferenceDocumentId) => ReferenceDocument;
  revision: number;
}

const ReferenceDocumentContext = createContext<ReferenceDocumentContextValue | null>(null);

export function ReferenceDocumentProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void initReferenceDocumentService().then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    const unsubscribe = subscribeReferenceDocuments(() => {
      setRevision((value) => value + 1);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const getDocument = useCallback((id: ReferenceDocumentId) => getReferenceDocument(id), [revision]);

  const value = useMemo(
    () => ({
      ready,
      getDocument,
      revision,
    }),
    [ready, getDocument, revision],
  );

  return (
    <ReferenceDocumentContext.Provider value={value}>{children}</ReferenceDocumentContext.Provider>
  );
}

export function useReferenceDocument(id: ReferenceDocumentId): ReferenceDocument {
  const context = useContext(ReferenceDocumentContext);
  if (!context) {
    throw new Error('useReferenceDocument must be used within ReferenceDocumentProvider');
  }
  return context.getDocument(id);
}

export function useReferenceDocumentsReady(): boolean {
  const context = useContext(ReferenceDocumentContext);
  if (!context) {
    throw new Error('useReferenceDocumentsReady must be used within ReferenceDocumentProvider');
  }
  return context.ready;
}
