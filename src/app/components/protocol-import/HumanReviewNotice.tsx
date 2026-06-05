import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function HumanReviewNotice({ compact = false }: { compact?: boolean }) {
  return (
    <Alert className={compact ? 'py-2' : undefined} data-testid="human-review-notice">
      <AlertTitle className={compact ? 'text-sm' : undefined}>Human review required</AlertTitle>
      <AlertDescription className="text-xs">
        Generated M11 section drafts are proposals only. A qualified reviewer must approve each section.
        Approval runs validation; validation does not replace human approval. SoA content is not extracted
        from DOCX in this release.
      </AlertDescription>
    </Alert>
  );
}
