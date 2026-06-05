# ICH M11 reference assets

## PDFs (user-managed)

Technical Specification and Template PDFs are **not** loaded from this folder at runtime.

Upload canonical PDFs in **Settings → ICH M11** (stored in browser IndexedDB). See `REFERENCE_DOCUMENT_UPLOADS.md`.

Legacy files in this directory are optional samples only:

| File | Notes |
|------|--------|
| `ICH_Step4_M11_Final_Template_2025_1119.pdf` | Optional sample; not used after upload |
| `ICH_M11_Technical_Specification.pdf` | Optional sample; not used after upload |

## Controlled terminology (bundled)

| File | Purpose |
|------|---------|
| `ichM11ControlledTerminology.json` | Static NCI EVS ingest; export copy for Settings → Controlled Terminology |

Regenerate: `npm run ingest:ich-m11-terminology`
