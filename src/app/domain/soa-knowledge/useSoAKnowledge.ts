import { useEffect, useState } from 'react';

import { getSoAKnowledgeSummary } from './soaKnowledgeSelectors';
import { getSoAKnowledge, subscribeSoAKnowledge } from './soaKnowledgeStore';

export function useSoAKnowledgeSummary() {
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribeSoAKnowledge(() => setRevision((value) => value + 1)), []);

  void revision;
  return getSoAKnowledgeSummary(getSoAKnowledge());
}

export function useSoAKnowledgeModel() {
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribeSoAKnowledge(() => setRevision((value) => value + 1)), []);

  void revision;
  return getSoAKnowledge();
}
