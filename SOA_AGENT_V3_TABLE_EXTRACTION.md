# SoA Agent v3 — Table-Aware Schedule Extraction

## Overview

SoA Agent v3 upgrades schedule intelligence from **narrative-only** extraction to **table-aware** extraction with proposal-gated matrix preview and bidirectional narrative sync.

```
Canonical Document
  ↓
Table-aware SoA extraction (DOCX)
  ↓
Narrative deterministic extraction
  ↓
Reconciliation (table wins placement, narrative wins context)
  ↓
Optional LLM enrichment (v2 layer, unchanged)
  ↓
SoA Knowledge proposal + matrix preview
  ↓
Human accept / reject
  ↓
SoA Knowledge / Configuration / Knowledge Graph update
  ↓
Narrative sync proposal + out-of-sync flags
```

## Design principles

- **No auto-accept** — all patches remain proposals until the user accepts.
- **No overwrite of user-edited SoA Configuration** without review (`applySoAConfigurationPatchSafely`).
- **No required Supabase, LLM, or OCR** — DOCX table path is fully local/deterministic.
- **Defensive** — missing/malformed tables produce diagnostics, never block import.

## Table extraction architecture

| Module | Role |
|--------|------|
| `soaTableExtractionTypes.ts` | Candidate tables, extraction result, matrix preview, provider interfaces |
| `soaTableExtractor.ts` | Detect SoA-like tables, extract visits/assessments/rules, build matrix preview |
| `soaTableNormalizer.ts` | Grid normalization, marker classification, role inference |
| `soaTableDiagnostics.ts` | Structured diagnostic codes + formatting |
| `soaTableReconciliation.ts` | `reconcileNarrativeAndTableSoAKnowledge()` |
| `soaTableExtractionProviders.ts` | DOCX provider + PDF/OCR stubs |

### Detection signals (no LLM)

- Headings: *Schedule of Activities*, *Schedule of Assessments*, *Study Calendar*, etc.
- Column labels: Screening, Baseline, Cycle, Day, Week, EOT, Follow-up, Every N weeks
- Row labels: vitals, ECG, labs, imaging, AEs, con meds
- Cell markers: X, ✓, Yes, Required, *if clinically indicated*

### Normalization

- Blank cells preserved
- Repeated header rows collapsed
- Merged-cell limitation recorded: *"Merged cell structure not available; normalized best effort."*

### Schedule rules

- Column headers → visits / timing windows
- Row labels → assessments
- Marked cells → `SoAScheduleRule` with table cell evidence (table id, row/col, source text)

## Matrix proposal preview

`SoAMatrixProposalPreview.tsx` renders a **preview-only** grid:

- Rows = assessments
- Columns = visits
- Cells = schedule markers with provenance badge (`deterministic-table`)

Accepting the SoA proposal applies knowledge patches through existing v1 accept chain.

## Narrative sync

| Module | Role |
|--------|------|
| `soaNarrativeSyncProposal.ts` | Proposal record types |
| `soaNarrativeSyncStore.ts` | localStorage store, refresh diagnostics |

After proposal accept:

- `createSoANarrativeSyncProposalFromSoAAcceptance()` creates a **proposed** sync record
- Does **not** auto-rewrite narrative text

After narrative section edit (sections 1.3, 4, 6, 8, 9, 10):

- `flagSoARefreshNeededForNarrativeSection()` adds diagnostic: *"Section 8 was edited; SoA assessments may require refresh."*

## PDF / OCR future path

Stub providers return clear `providerUnavailable` diagnostics:

- `PdfTextTableExtractionProvider` — digital PDF text extraction (future)
- `OcrTableExtractionProvider` — scanned PDF OCR fallback only (future)

OCR is intentionally **not** implemented in v3.

## Supabase audit scaffold (not wired)

- `SoAProposalAuditRepository` — proposal accept/reject + evidence coordinates
- `SoATableExtractionRepository` — table extraction artifacts

## Build console events

- SoA table extraction started
- Found X candidate schedule tables
- Extracted Y visits / Z schedule rules from tables
- Reconciling narrative and table evidence
- Created matrix proposal preview
- Narrative sync proposal created
- SoA Agent v3 completed

## UI

`SoAProposalReviewPanel` tabs:

1. Summary (source counts: narrative / table / LLM / conflicts)
2. Matrix Preview
3. Extracted Items
4. Evidence (table id, row/col, cell text)
5. Diagnostics
6. Narrative Sync

## Tests

```bash
npm run test:soa-table-extraction
```

## Known limitations (v3)

- DOCX merged cells not represented in mammoth extraction
- Tables appended at canonical block tail may have weak section association
- Matrix preview is illustrative, not the generated SoA matrix engine
- Narrative sync proposals are advisory only

## Recommended v4 direction

1. Associate canonical tables with section boundaries by source offset
2. Digital PDF text table parser sharing normalization pipeline
3. OCR fallback with confidence-gated proposals only
4. Wire Supabase audit repositories
5. Richer narrative sync text suggestions with diff preview
