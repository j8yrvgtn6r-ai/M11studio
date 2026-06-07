import { useEffect, useState } from 'react';

import {
  getCurrentSoAEnrichmentProposal,
  subscribeSoAEnrichmentProposal,
} from './soaEnrichmentStore';
import type { SoAEnrichmentProposal } from './soaEnrichmentProposal';

export function useSoAEnrichmentProposal(): SoAEnrichmentProposal | null {
  const [proposal, setProposal] = useState<SoAEnrichmentProposal | null>(() => getCurrentSoAEnrichmentProposal());

  useEffect(() => subscribeSoAEnrichmentProposal(() => {
    setProposal(getCurrentSoAEnrichmentProposal());
  }), []);

  return proposal;
}
