import { useMemo } from 'react';

import { evaluateSoAEnrichmentReadiness, evaluateSoAFirstPassReadiness } from '../../domain/soa-knowledge/soaReadinessEvaluator';
import { subscribeSoAKnowledge } from '../../domain/soa-knowledge/soaKnowledgeStore';
import { subscribeSoAProposal } from '../../domain/soa-knowledge/soaProposalStore';
import { subscribeStudyDesign } from '../../domain/study-design/StudyDesignStore';
import { subscribeStudyModel } from '../../domain/study-model/studyModelStore';
import { subscribe } from '../../domain/protocol';
import { subscribeProtocolImport } from '../../domain/protocol/import';
import { useEffect, useState } from 'react';

export function useSoAReadiness() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    const unsubProtocol = subscribe(bump);
    const unsubKnowledge = subscribeSoAKnowledge(bump);
    const unsubStudy = subscribeStudyModel(bump);
    const unsubStudyDesign = subscribeStudyDesign(bump);
    const unsubProposal = subscribeSoAProposal(bump);
    const unsubImport = subscribeProtocolImport(bump);
    return () => {
      unsubProtocol();
      unsubKnowledge();
      unsubStudy();
      unsubStudyDesign();
      unsubProposal();
      unsubImport();
    };
  }, []);

  return useMemo(
    () => ({
      firstPass: evaluateSoAFirstPassReadiness(),
      enrichment: evaluateSoAEnrichmentReadiness(),
    }),
    [revision],
  );
}
