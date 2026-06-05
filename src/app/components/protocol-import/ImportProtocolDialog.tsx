import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Upload } from 'lucide-react';

import {
  createInitialProcessingSteps,
  DocxExtractionError,
  isDocxFile,
  runProtocolImportProcessing,
  setProtocolImportArtifact,
  setProtocolImportExtractionFailed,
  setProtocolImportResult,
  storeUploadedDocxArtifact,
} from '../../domain/protocol/import';
import type { ImportProcessingStep, ProtocolSourceArtifact } from '../../domain/protocol/import';
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

type ImportWizardStep = 'upload' | 'processing' | 'complete';

interface ImportProtocolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportProtocolDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ImportProtocolDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wizardStep, setWizardStep] = useState<ImportWizardStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ImportProcessingStep[]>(
    createInitialProcessingSteps,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [completedKnowledge, setCompletedKnowledge] = useState<ProtocolKnowledgeModel | null>(null);

  const resetWizard = useCallback(() => {
    setWizardStep('upload');
    setSelectedFile(null);
    setOverwriteConfirmed(false);
    setUploadError(null);
    setProcessingSteps(createInitialProcessingSteps());
    setIsDragging(false);
    setCompletedKnowledge(null);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && wizardStep === 'processing') {
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

  const startProcessing = async () => {
    if (!selectedFile || !overwriteConfirmed) {
      return;
    }

    setWizardStep('processing');
    setUploadError(null);

    let artifact: ProtocolSourceArtifact | null = null;
    try {
      artifact = await storeUploadedDocxArtifact(selectedFile);
      const blob = new Blob([await selectedFile.arrayBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      setProtocolImportArtifact(artifact, blob);

      const { artifact: processedArtifact, importedSource, protocolKnowledgeModel, sectionDrafts } =
        await runProtocolImportProcessing(
          { ...artifact, status: 'processing' },
          blob,
          { onStepsUpdate: setProcessingSteps },
        );

      await setProtocolImportResult(
        sectionDrafts,
        processedArtifact,
        importedSource,
        protocolKnowledgeModel,
        { isOverwrite: true },
      );
      setCompletedKnowledge(protocolKnowledgeModel);
      setWizardStep('complete');
    } catch (error) {
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
    }
  };

  const handleFinish = () => {
    onImportComplete();
    handleOpenChange(false);
    resetWizard();
  };

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

            {uploadError ? <p className="text-sm text-destructive" data-testid="import-upload-error">{uploadError}</p> : null}
          </div>
        ) : null}

        {wizardStep === 'processing' ? (
          <ProtocolImportProcessingSteps steps={processingSteps} />
        ) : null}

        {wizardStep === 'complete' ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-2">
              <p className="font-medium">Review package ready</p>
              <p className="text-muted-foreground">
                Protocol understanding and M11 draft generation completed. Human review is required before any
                section becomes approved protocol content.
              </p>
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
            <Button data-testid="import-protocol-open-review" onClick={handleFinish}>
              Open review workspace
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
