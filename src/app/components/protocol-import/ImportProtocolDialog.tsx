import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Upload } from 'lucide-react';

import {
  createInitialProcessingSteps,
  DocxExtractionError,
  ImportProcessingAbortedError,
  isDocxFile,
  prepareProtocolImportOverwrite,
  retryFailedM11SectionGeneration,
  runProtocolImportProcessing,
  setProtocolImportArtifact,
  setProtocolImportExtractionFailed,
  setProtocolImportResult,
  storeUploadedDocxArtifact,
  getImportedProtocolSource,
  getProtocolImportState,
  getProtocolKnowledgeModel,
} from '../../domain/protocol/import';
import {
  endProtocolBuildSession,
  registerProtocolBuildControls,
  requestPauseAfterCurrentSection,
  resumeProtocolBuild,
  setProtocolBuildGenerationProgress,
  startProtocolBuildSession,
} from '../../domain/protocol/build/protocolBuildConsoleStore';
import type {
  GeneratedSectionDraft,
  ImportProcessingStep,
  ImportedProtocolSource,
  ProtocolSourceArtifact,
} from '../../domain/protocol/import';
import type { ProtocolKnowledgeModel } from '../../domain/protocol/import/protocolKnowledgeTypes';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { ImportProtocolProviderBanner } from './ImportProtocolProviderBanner';

interface ImportProtocolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (summary: {
    sectionCount: number;
    failedSectionIds: string[];
    partialGenerationFailure: boolean;
  }) => void;
}

interface CompletedImportContext {
  artifact: ProtocolSourceArtifact;
  importedSource: ImportedProtocolSource;
  protocolKnowledgeModel: ProtocolKnowledgeModel;
  sectionDrafts: GeneratedSectionDraft[];
  failedSectionIds: string[];
}

export function ImportProtocolDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ImportProtocolDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconstructionStartedRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ImportProcessingStep[]>(
    createInitialProcessingSteps(),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [completedContext, setCompletedContext] = useState<CompletedImportContext | null>(null);
  const [processingActive, setProcessingActive] = useState(false);

  const resetWizard = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    reconstructionStartedRef.current = false;
    setSelectedFile(null);
    setOverwriteConfirmed(false);
    setUploadError(null);
    setProcessingSteps(createInitialProcessingSteps());
    setIsDragging(false);
    setCompletedContext(null);
    setProcessingActive(false);
    endProtocolBuildSession('idle');
  }, []);

  useEffect(() => {
    registerProtocolBuildControls({
      cancel: () => abortControllerRef.current?.abort(),
      pauseAfterCurrent: () => requestPauseAfterCurrentSection(),
      resume: () => resumeProtocolBuild(),
      retryFailed: () => {
        void handleRetryFailedSectionsRef.current?.();
      },
    });
  }, []);

  const handleRetryFailedSectionsRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const processingCallbacks = {
    onStepsUpdate: (steps: ImportProcessingStep[]) => {
      setProcessingSteps(steps);
      if (steps.some((step) => step.id === 'rewriting-m11' && step.state === 'active')) {
        reconstructionStartedRef.current = true;
      }
    },
    onGenerationProgress: setProtocolBuildGenerationProgress,
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (processingActive) {
        return;
      }
      onOpenChange(true);
      return;
    }

    if (processingActive) {
      onOpenChange(false);
      return;
    }

    resetWizard();
    onOpenChange(false);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!isDocxFile(file)) {
      setUploadError('Only .docx files are supported in v1. PDF support is planned for a later release.');
      setSelectedFile(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
  };

  const persistImportResult = async (context: CompletedImportContext) => {
    await setProtocolImportResult(
      context.sectionDrafts,
      context.artifact,
      context.importedSource,
      context.protocolKnowledgeModel,
      { isOverwrite: true },
    );
    setCompletedContext(context);
  };

  const startProcessing = async () => {
    if (!selectedFile || !overwriteConfirmed) {
      return;
    }

    setUploadError(null);
    setProcessingActive(true);
    setProcessingSteps(createInitialProcessingSteps());
    reconstructionStartedRef.current = false;
    prepareProtocolImportOverwrite();
    startProtocolBuildSession({ mode: 'Full' });
    onOpenChange(false);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let artifact: ProtocolSourceArtifact | null = null;
    try {
      artifact = await storeUploadedDocxArtifact(selectedFile);
      const blob = new Blob([await selectedFile.arrayBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      setProtocolImportArtifact(artifact, blob);

      const result = await runProtocolImportProcessing(
        { ...artifact, status: 'processing' },
        blob,
        {
          ...processingCallbacks,
          signal: abortController.signal,
        },
      );

      const context: CompletedImportContext = {
        artifact: result.artifact,
        importedSource: result.importedSource,
        protocolKnowledgeModel: result.protocolKnowledgeModel,
        sectionDrafts: result.sectionDrafts,
        failedSectionIds: result.failedSectionIds,
      };

      await persistImportResult(context);
      onImportComplete({
        sectionCount: result.sectionDrafts.length,
        failedSectionIds: result.failedSectionIds,
        partialGenerationFailure: result.partialGenerationFailure,
      });
    } catch (error) {
      if (error instanceof ImportProcessingAbortedError) {
        endProtocolBuildSession('cancelled');
        if (!reconstructionStartedRef.current) {
          onOpenChange(true);
          setUploadError('Import cancelled.');
        }
        return;
      }

      endProtocolBuildSession('failed');

      const message =
        error instanceof DocxExtractionError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Import processing failed.';

      if (artifact) {
        setProtocolImportExtractionFailed(artifact, message);
      }

      if (!reconstructionStartedRef.current) {
        onOpenChange(true);
        setUploadError(
          error instanceof DocxExtractionError
            ? `${message} The uploaded DOCX is saved — fix the file and try again.`
            : message,
        );
      }
    } finally {
      setProcessingActive(false);
      abortControllerRef.current = null;
    }
  };

  const handleRetryFailedSections = async () => {
    const importState = getProtocolImportState();
    const source = getImportedProtocolSource();
    const knowledge = getProtocolKnowledgeModel();
    const artifact = importState.artifact ?? completedContext?.artifact;
    const existingDrafts = Object.values(importState.sectionDrafts);
    const failedSectionIds = completedContext?.failedSectionIds ?? existingDrafts
      .filter((draft) => draft.generationStatus === 'failed')
      .map((draft) => draft.sectionId);

    if (!artifact || !source || !knowledge || failedSectionIds.length === 0) {
      return;
    }

    setProcessingActive(true);
    onOpenChange(false);
    startProtocolBuildSession({ mode: 'Selected' });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    reconstructionStartedRef.current = true;

    try {
      const retried = await retryFailedM11SectionGeneration(
        artifact,
        source,
        knowledge,
        existingDrafts,
        {
          ...processingCallbacks,
          signal: abortController.signal,
        },
      );

      const context: CompletedImportContext = {
        artifact,
        importedSource: source,
        protocolKnowledgeModel: knowledge,
        sectionDrafts: retried.sectionDrafts,
        failedSectionIds: retried.failedSectionIds,
      };

      await persistImportResult(context);
      onImportComplete({
        sectionCount: retried.sectionDrafts.length,
        failedSectionIds: retried.failedSectionIds,
        partialGenerationFailure: retried.partialGenerationFailure,
      });
    } catch (error) {
      if (error instanceof ImportProcessingAbortedError) {
        return;
      }
    } finally {
      setProcessingActive(false);
      abortControllerRef.current = null;
    }
  };

  handleRetryFailedSectionsRef.current = handleRetryFailedSections;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="import-protocol-dialog">
        <DialogHeader>
          <DialogTitle>Import Protocol</DialogTitle>
          <DialogDescription>
            This workflow understands your uploaded protocol as a complete study design document, then
            reconstructs ICH M11 section proposals. Generated content is never auto-approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ImportProtocolProviderBanner />

          <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Overwrite warning</AlertTitle>
            <AlertDescription>
              Importing a protocol will overwrite any draft protocol content currently created in M11 Studio.
              The uploaded source document will be retained as a reference artifact, but generated M11 sections
              will replace existing draft section content after processing.
            </AlertDescription>
          </Alert>

          {processingActive ? (
            <Alert data-testid="import-processing-background-notice">
              <AlertTitle>Reconstruction running in workspace</AlertTitle>
              <AlertDescription>
                Protocol reconstruction continues in the background. Use Protocol Reconstruction Progress at the
                bottom of the screen for live status and controls.
              </AlertDescription>
            </Alert>
          ) : null}

          <div
            className={`rounded-lg border border-dashed p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
            }`}
            data-testid="import-protocol-dropzone"
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFile(event.dataTransfer.files[0]);
            }}
          >
            <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Drag and drop a protocol DOCX here</p>
            <p className="text-xs text-muted-foreground mt-1">PDF support planned for a later release</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              disabled={processingActive}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Choose file
            </Button>
            {selectedFile ? (
              <p className="text-xs mt-3 font-mono text-foreground">{selectedFile.name}</p>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            data-testid="import-protocol-file-input"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <div className="flex items-start gap-2">
            <Checkbox
              id="import-overwrite-confirm"
              checked={overwriteConfirmed}
              disabled={processingActive}
              onCheckedChange={(checked) => setOverwriteConfirmed(checked === true)}
              data-testid="import-overwrite-confirm"
            />
            <Label htmlFor="import-overwrite-confirm" className="text-sm leading-snug cursor-pointer">
              I understand this import will overwrite current generated protocol content.
            </Label>
          </div>

          {uploadError ? (
            <p className="text-sm text-destructive" data-testid="import-upload-error">
              {uploadError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={processingActive} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="import-protocol-continue"
            disabled={!selectedFile || !overwriteConfirmed || processingActive}
            onClick={() => void startProcessing()}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
