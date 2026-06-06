import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Upload } from 'lucide-react';

import {
  createInitialProcessingSteps,
  DocxExtractionError,
  ImportProcessingAbortedError,
  isDocxFile,
  retryFailedM11SectionGeneration,
  runProtocolImportProcessing,
  setProtocolImportArtifact,
  setProtocolImportExtractionFailed,
  setProtocolImportResult,
  storeUploadedDocxArtifact,
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
import { ProtocolUnderstandingSummary } from './ProtocolUnderstandingSummary';
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
import { ProtocolImportProcessingSteps } from './ProtocolImportProcessingSteps';
import { useProtocolBuildConsole } from '../../domain/protocol/build/useProtocolBuildConsole';

type ImportWizardStep = 'upload' | 'processing' | 'complete';

interface ImportProtocolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
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
  const [wizardStep, setWizardStep] = useState<ImportWizardStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ImportProcessingStep[]>(
    createInitialProcessingSteps,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [completedKnowledge, setCompletedKnowledge] = useState<ProtocolKnowledgeModel | null>(null);
  const [completedContext, setCompletedContext] = useState<CompletedImportContext | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [processingActive, setProcessingActive] = useState(false);
  const buildState = useProtocolBuildConsole();

  const resetWizard = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setWizardStep('upload');
    setSelectedFile(null);
    setOverwriteConfirmed(false);
    setUploadError(null);
    setProcessingSteps(createInitialProcessingSteps());
    setIsDragging(false);
    setCompletedKnowledge(null);
    setCompletedContext(null);
    setIsRetrying(false);
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
    onStepsUpdate: setProcessingSteps,
    onGenerationProgress: setProtocolBuildGenerationProgress,
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && processingActive) {
      return;
    }
    if (!nextOpen) {
      resetWizard();
    }
    onOpenChange(nextOpen);
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
    setCompletedKnowledge(context.protocolKnowledgeModel);
    setCompletedContext(context);
    setWizardStep('complete');
  };

  const startProcessing = async () => {
    if (!selectedFile || !overwriteConfirmed) {
      return;
    }

    setWizardStep('processing');
    setUploadError(null);
    setProcessingActive(true);
    setProcessingSteps(createInitialProcessingSteps());
    startProtocolBuildSession({ mode: 'Full' });

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

      await persistImportResult({
        artifact: result.artifact,
        importedSource: result.importedSource,
        protocolKnowledgeModel: result.protocolKnowledgeModel,
        sectionDrafts: result.sectionDrafts,
        failedSectionIds: result.failedSectionIds,
      });
    } catch (error) {
      if (error instanceof ImportProcessingAbortedError) {
        endProtocolBuildSession('cancelled');
        setUploadError('Import cancelled.');
        setWizardStep('upload');
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

      setUploadError(
        error instanceof DocxExtractionError
          ? `${message} The uploaded DOCX is saved — fix the file and try again.`
          : message,
      );
      setWizardStep('upload');
    } finally {
      setProcessingActive(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelProcessing = () => {
    abortControllerRef.current?.abort();
  };

  const handleRetryFailedSections = async () => {
    if (!completedContext || (completedContext.failedSectionIds ?? []).length === 0) {
      return;
    }

    setIsRetrying(true);
    setProcessingActive(true);
    setWizardStep('processing');
    setUploadError(null);
    startProtocolBuildSession({ mode: 'Selected' });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const retried = await retryFailedM11SectionGeneration(
        completedContext.artifact,
        completedContext.importedSource,
        completedContext.protocolKnowledgeModel,
        completedContext.sectionDrafts,
        {
          ...processingCallbacks,
          signal: abortController.signal,
        },
      );

      await persistImportResult({
        artifact: completedContext.artifact,
        importedSource: completedContext.importedSource,
        protocolKnowledgeModel: completedContext.protocolKnowledgeModel,
        sectionDrafts: retried.sectionDrafts,
        failedSectionIds: retried.failedSectionIds,
      });
    } catch (error) {
      if (error instanceof ImportProcessingAbortedError) {
        setUploadError('Retry cancelled.');
        setWizardStep('complete');
        return;
      }
      setUploadError(error instanceof Error ? error.message : 'Retry failed.');
      setWizardStep('complete');
    } finally {
      setIsRetrying(false);
      setProcessingActive(false);
      abortControllerRef.current = null;
    }
  };

  handleRetryFailedSectionsRef.current = handleRetryFailedSections;

  const handleFinish = () => {
    onImportComplete();
    onOpenChange(false);
    setWizardStep('upload');
    setSelectedFile(null);
    setOverwriteConfirmed(false);
    setUploadError(null);
    setProcessingSteps(createInitialProcessingSteps());
    setIsDragging(false);
    setCompletedKnowledge(null);
    setCompletedContext(null);
    setIsRetrying(false);
    setProcessingActive(false);
  };

  const hasFailedSections = (completedContext?.failedSectionIds?.length ?? 0) > 0;

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

        {wizardStep === 'upload' ? (
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
        ) : null}

        {wizardStep === 'processing' ? (
          <div className="space-y-4">
            <ProtocolImportProcessingSteps steps={processingSteps} />
            <div className="flex flex-wrap justify-end gap-2">
              {buildState.status === 'paused' ? (
                <Button
                  variant="secondary"
                  data-testid="import-resume-processing"
                  onClick={() => resumeProtocolBuild()}
                >
                  Resume
                </Button>
              ) : (
                <Button
                  variant="outline"
                  data-testid="import-pause-processing"
                  onClick={() => requestPauseAfterCurrentSection()}
                >
                  Pause After Current Section
                </Button>
              )}
              <Button
                variant="outline"
                data-testid="import-cancel-processing"
                onClick={handleCancelProcessing}
              >
                Cancel Import
              </Button>
            </div>
          </div>
        ) : null}

        {wizardStep === 'complete' ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-2">
              <p className="font-medium">Review package ready</p>
              <p className="text-muted-foreground">
                Protocol understanding and M11 draft generation completed. Human review is required before any
                section becomes approved protocol content.
              </p>
              {hasFailedSections ? (
                <p className="text-destructive text-xs" data-testid="import-partial-generation-warning">
                  {completedContext?.failedSectionIds?.length ?? 0} section(s) failed to generate. Retry failed sections
                  before opening review, or continue with partial drafts.
                </p>
              ) : null}
            </div>
            {completedKnowledge ? <ProtocolUnderstandingSummary knowledge={completedKnowledge} /> : null}
          </div>
        ) : null}

        <DialogFooter>
          {wizardStep === 'upload' ? (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                data-testid="import-protocol-continue"
                disabled={!selectedFile || !overwriteConfirmed}
                onClick={() => void startProcessing()}
              >
                Continue
              </Button>
            </>
          ) : null}
          {wizardStep === 'complete' ? (
            <>
              {hasFailedSections ? (
                <Button
                  variant="secondary"
                  data-testid="import-retry-failed-sections"
                  disabled={isRetrying}
                  onClick={() => void handleRetryFailedSections()}
                >
                  Retry Failed Sections
                </Button>
              ) : null}
              <Button data-testid="import-protocol-open-review" onClick={handleFinish}>
                Open review workspace
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
