import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ReferenceDocumentPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  blobUrl: string | null;
}

export function ReferenceDocumentPdfDialog({
  open,
  onOpenChange,
  title,
  blobUrl,
}: ReferenceDocumentPdfDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Uploaded reference PDF</DialogDescription>
        </DialogHeader>
        {blobUrl ? (
          <iframe
            title={title}
            src={blobUrl}
            className="flex-1 w-full min-h-0 rounded-md border border-border bg-muted/30"
            data-testid="reference-document-pdf-viewer"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No document available.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
