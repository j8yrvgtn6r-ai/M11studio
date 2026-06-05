import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, FileDown, FileText, Loader2, Upload } from 'lucide-react';

import {
  ichM11PdfKindToReferenceDocumentId,
  downloadIchM11UploadedPdf,
  formatReferenceDocumentFileSize,
  formatReferenceDocumentUploadedAt,
  getReferenceDocumentBlobUrl,
  uploadReferenceDocumentPdf,
  useReferenceDocument,
  useReferenceDocumentsReady,
} from '../../domain/referenceDocuments';
import type { IchM11PdfReferenceDocumentKind } from '../../domain/protocol/ichM11/ichM11ReferenceDocuments';
import { getIchM11ReferenceDocument } from '../../domain/protocol/ichM11/ichM11ReferenceDocuments';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { ReferenceDocumentPdfDialog } from './ReferenceDocumentPdfDialog';

interface IchM11DocumentCardProps {
  kind: IchM11PdfReferenceDocumentKind;
  sectionCount: number;
}

type UploadFeedback = 'idle' | 'success' | 'error';

export function IchM11DocumentCard({ kind, sectionCount }: IchM11DocumentCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const ready = useReferenceDocumentsReady();
  const documentId = ichM11PdfKindToReferenceDocumentId(kind);
  const referenceDocument = useReferenceDocument(documentId);
  const asset = getIchM11ReferenceDocument(kind);
  const { meta } = asset;

  const uploaded = referenceDocument.status === 'uploaded';
  const uploading = referenceDocument.status === 'uploading';
  const blobUrl = uploaded ? getReferenceDocumentBlobUrl(documentId) : null;

  const label = kind === 'template' ? 'Template' : 'Technical Specification';

  const handleUploadClick = () => {
    setUploadFeedback('idle');
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploadFeedback('idle');
    setUploadError(null);

    try {
      await uploadReferenceDocumentPdf(documentId, file);
      setUploadFeedback('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      setUploadError(message);
      setUploadFeedback('error');
    }
  };

  const handleView = () => {
    if (!blobUrl) {
      return;
    }
    setViewerOpen(true);
  };

  const handleDownload = () => {
    downloadIchM11UploadedPdf(kind);
  };

  return (
    <>
      <Card data-testid={`ich-m11-doc-card-${kind}`}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {label}
          </CardTitle>
          <CardDescription>{meta.title}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Version</p>
            <p className="font-medium">{referenceDocument.version}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Document status</p>
            {uploading ? (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading…
              </Badge>
            ) : uploaded ? (
              <Badge variant="secondary">Uploaded</Badge>
            ) : referenceDocument.status === 'error' ? (
              <Badge variant="destructive">Upload failed</Badge>
            ) : (
              <Badge variant="outline">Not uploaded</Badge>
            )}
          </div>

          {uploaded ? (
            <>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Current document</p>
                <p className="font-mono text-xs break-all">{referenceDocument.filename}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Uploaded</p>
                <p>{formatReferenceDocumentUploadedAt(referenceDocument.uploadedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Size</p>
                <p>{formatReferenceDocumentFileSize(referenceDocument.fileSize)}</p>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 text-muted-foreground">No document uploaded.</div>
          )}

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Parsed sections</p>
            <p className="font-medium tabular-nums">{sectionCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Storage path</p>
            <p className="font-mono text-xs break-all">{referenceDocument.storagePath}</p>
          </div>

          {uploadFeedback === 'success' ? (
            <div className="sm:col-span-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              PDF uploaded successfully. View and Download are now available.
            </div>
          ) : null}

          {uploadFeedback === 'error' || referenceDocument.errorMessage ? (
            <div className="sm:col-span-2 flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{uploadError ?? referenceDocument.errorMessage}</span>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            data-testid={`ich-m11-view-${kind}`}
            disabled={!ready || !uploaded || uploading}
            onClick={handleView}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            data-testid={`ich-m11-download-${kind}`}
            disabled={!ready || !uploaded || uploading}
            onClick={handleDownload}
          >
            <FileDown className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            data-testid={`ich-m11-upload-${kind}`}
            disabled={!ready || uploading}
            onClick={handleUploadClick}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload PDF
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            data-testid={`ich-m11-upload-input-${kind}`}
            onChange={handleFileChange}
          />
        </CardFooter>
      </Card>

      <ReferenceDocumentPdfDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        title={referenceDocument.filename ?? meta.title}
        blobUrl={blobUrl}
      />
    </>
  );
}
