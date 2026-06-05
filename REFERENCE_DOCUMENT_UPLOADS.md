# Reference document uploads

## Storage strategy

Uploaded ICH M11 PDFs are stored in the browser **IndexedDB** database `m11-studio-reference-documents`, object store `documents`, keyed by `ReferenceDocumentId`.

Logical storage paths (not filesystem paths in the repo):

| Document | Path |
|----------|------|
| Technical Specification | `reference/ich-m11/technical-specification.pdf` |
| Template | `reference/ich-m11/template.pdf` |

After upload, the blob in IndexedDB is the **active** document. Bundled `public/reference/*.pdf` placeholders are not used for View/Download.

## Registry

`ReferenceDocument` in `src/app/domain/referenceDocuments/types.ts` supports future slots (USDM, SDTMIG, CDASH, Define-XML, sponsor SOPs, terminology packages) without changing the upload API shape.

## Upload workflow

1. Settings → ICH M11 → **Upload PDF** on a card.
2. File picker accepts PDF only.
3. Card shows uploading → success or failure.
4. Metadata updates: filename, uploaded timestamp, file size, status.
5. View opens an embedded PDF dialog; Download saves the uploaded file.

## Persistence

Survives page reload and browser restart (same origin). Clearing site data removes uploads.

## Regenerate terminology (unchanged)

`npm run ingest:ich-m11-terminology` — static JSON only; not user-uploaded.

## Known limitations

- Storage is per-browser, not synced across devices.
- No server-side backup or version history (single active file per slot).
- Large PDFs are limited by browser IndexedDB quotas.
- Playwright smoke uploads `scripts/fixtures/minimal.pdf` to exercise the flow.
