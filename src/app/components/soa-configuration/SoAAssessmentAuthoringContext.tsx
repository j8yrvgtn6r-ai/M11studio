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
  deleteSoAAssessmentDefinition,
  describeSoAAssessmentDefinitionMutationFailure,
  findDesignEntityInDocument,
  getAssessmentScheduleRulesForAssessment,
  getAssessments,
  getDeleteSoAAssessmentDefinitionFailure,
  getProtocolDocument,
  getSoACells,
  getSoAAssessmentDefinitions,
  getVisitDefinitions,
  soaAssessmentDefinitionHasScheduleRules,
  subscribe,
} from '../../domain/protocol';
import type { SoAAssessmentDefinition } from '../../domain/protocol/types';
import {
  SoAAssessmentDefinitionEditorDialog,
  type SoAAssessmentDefinitionEditorMode,
} from './SoAAssessmentDefinitionEditorDialog';
import {
  buildAssessmentVisitAppearances,
  collectLinkedSectionReferences,
  computeSoAAssessmentGeneratedImpact,
} from './soaAssessmentImpact';
import { buildSoAAssessmentValidationIndex } from './soaAssessmentValidationIndex';

import type { SoAAssessmentValidationEntry } from './soaAssessmentValidationIndex';

interface SoAAssessmentAuthoringContextValue {
  selectedAssessmentId: string | null;
  setSelectedAssessmentId: (assessmentId: string | null) => void;
  selectedDefinition: SoAAssessmentDefinition | null;
  selectedValidation: SoAAssessmentValidationEntry | undefined;
  selectedRules: ReturnType<typeof getAssessmentScheduleRulesForAssessment>;
  selectedClinicalDesign: ReturnType<typeof findDesignEntityInDocument>;
  selectedVisitAppearances: ReturnType<typeof buildAssessmentVisitAppearances>;
  selectedLinkedSections: string[];
  selectedGeneratedImpact: ReturnType<typeof computeSoAAssessmentGeneratedImpact> | null;
  canDelete: boolean;
  deleteBlockedReason: string | null;
  deleteError: string | null;
  showNarrativeNotice: boolean;
  openCreateEditor: () => void;
  openEditEditor: () => void;
  handleDelete: () => void;
  clearDeleteError: () => void;
}

const SoAAssessmentAuthoringContext = createContext<SoAAssessmentAuthoringContextValue | null>(null);

export function SoAAssessmentAuthoringProvider({ children }: { children: ReactNode }) {
  const [protocolRevision, setProtocolRevision] = useState(0);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<SoAAssessmentDefinitionEditorMode>('create');
  const [showNarrativeNotice, setShowNarrativeNotice] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    return subscribe(() => {
      setProtocolRevision((revision) => revision + 1);
    });
  }, []);

  useEffect(() => {
    if (!showNarrativeNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowNarrativeNotice(false);
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showNarrativeNotice]);

  const document = useMemo(() => getProtocolDocument(), [protocolRevision]);
  const definitions = useMemo(
    () => [...getSoAAssessmentDefinitions(document)].sort((left, right) => left.order - right.order),
    [document],
  );
  const validationIndex = useMemo(() => buildSoAAssessmentValidationIndex(document), [document]);
  const visitById = useMemo(
    () => new Map(getVisitDefinitions(document).map((visit) => [visit.id, visit])),
    [document],
  );
  const generatedAssessments = useMemo(() => getAssessments(document), [document]);
  const generatedCells = useMemo(() => getSoACells(document), [document]);

  useEffect(() => {
    if (definitions.length === 0) {
      setSelectedAssessmentId(null);
      return;
    }
    if (!selectedAssessmentId || !definitions.some((definition) => definition.id === selectedAssessmentId)) {
      setSelectedAssessmentId(definitions[0].id);
    }
  }, [definitions, selectedAssessmentId]);

  const selectedDefinition = definitions.find((definition) => definition.id === selectedAssessmentId) ?? null;
  const selectedRules = selectedDefinition
    ? getAssessmentScheduleRulesForAssessment(selectedDefinition.id, document)
    : [];
  const selectedValidation = selectedDefinition ? validationIndex.get(selectedDefinition.id) : undefined;
  const selectedClinicalDesign = selectedDefinition?.clinicalDesignAssessmentId
    ? findDesignEntityInDocument(document, selectedDefinition.clinicalDesignAssessmentId)
    : null;
  const selectedVisitAppearances = buildAssessmentVisitAppearances(selectedRules, visitById);
  const selectedLinkedSections = selectedDefinition
    ? collectLinkedSectionReferences(selectedDefinition.linkedSectionId, selectedRules)
    : [];
  const selectedGeneratedImpact = selectedDefinition
    ? computeSoAAssessmentGeneratedImpact(
        selectedDefinition.id,
        selectedRules,
        generatedCells,
        generatedAssessments,
      )
    : null;

  const canDelete = Boolean(selectedDefinition) &&
    !soaAssessmentDefinitionHasScheduleRules(selectedDefinition?.id ?? '', document);
  const selectedDeleteFailure = selectedDefinition
    ? getDeleteSoAAssessmentDefinitionFailure(selectedDefinition.id, document)
    : null;
  const deleteBlockedReason =
    selectedDeleteFailure === 'referenced_by_rules'
      ? describeSoAAssessmentDefinitionMutationFailure('referenced_by_rules')
      : null;

  const openCreateEditor = useCallback(() => {
    setEditorMode('create');
    setEditorOpen(true);
  }, []);

  const openEditEditor = useCallback(() => {
    setEditorMode('edit');
    setEditorOpen(true);
  }, []);

  const handleMutationSuccess = useCallback((definitionId: string) => {
    setSelectedAssessmentId(definitionId);
    setShowNarrativeNotice(true);
    setDeleteError(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (!selectedDefinition) {
      return;
    }

    const failure = getDeleteSoAAssessmentDefinitionFailure(selectedDefinition.id, document);
    if (failure) {
      setDeleteError(describeSoAAssessmentDefinitionMutationFailure(failure));
      return;
    }

    if (!deleteSoAAssessmentDefinition(selectedDefinition.id)) {
      setDeleteError('Could not delete assessment.');
      return;
    }

    setDeleteError(null);
    setShowNarrativeNotice(true);
  }, [document, selectedDefinition]);

  const clearDeleteError = useCallback(() => {
    setDeleteError(null);
  }, []);

  const value = useMemo<SoAAssessmentAuthoringContextValue>(
    () => ({
      selectedAssessmentId,
      setSelectedAssessmentId,
      selectedDefinition,
      selectedValidation,
      selectedRules,
      selectedClinicalDesign,
      selectedVisitAppearances,
      selectedLinkedSections,
      selectedGeneratedImpact,
      canDelete,
      deleteBlockedReason,
      deleteError,
      showNarrativeNotice,
      openCreateEditor,
      openEditEditor,
      handleDelete,
      clearDeleteError,
    }),
    [
      selectedAssessmentId,
      selectedDefinition,
      selectedValidation,
      selectedRules,
      selectedClinicalDesign,
      selectedVisitAppearances,
      selectedLinkedSections,
      selectedGeneratedImpact,
      canDelete,
      deleteBlockedReason,
      deleteError,
      showNarrativeNotice,
      openCreateEditor,
      openEditEditor,
      handleDelete,
      clearDeleteError,
    ],
  );

  return (
    <SoAAssessmentAuthoringContext.Provider value={value}>
      {children}
      <SoAAssessmentDefinitionEditorDialog
        open={editorOpen}
        mode={editorMode}
        definition={selectedDefinition}
        document={document}
        onOpenChange={setEditorOpen}
        onSuccess={handleMutationSuccess}
      />
    </SoAAssessmentAuthoringContext.Provider>
  );
}

export function useSoAAssessmentAuthoring(): SoAAssessmentAuthoringContextValue {
  const context = useContext(SoAAssessmentAuthoringContext);
  if (!context) {
    throw new Error('useSoAAssessmentAuthoring must be used within SoAAssessmentAuthoringProvider');
  }
  return context;
}

/** Optional hook for DetailInspector when provider may be absent. */
export function useSoAAssessmentAuthoringOptional(): SoAAssessmentAuthoringContextValue | null {
  return useContext(SoAAssessmentAuthoringContext);
}
