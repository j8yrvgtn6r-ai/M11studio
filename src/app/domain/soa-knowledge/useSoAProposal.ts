import { useEffect, useState } from 'react';

import { getCurrentSoAProposal, subscribeSoAProposal } from './soaProposalStore';

export function useSoAProposal() {
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribeSoAProposal(() => setRevision((value) => value + 1)), []);

  void revision;
  return getCurrentSoAProposal();
}
