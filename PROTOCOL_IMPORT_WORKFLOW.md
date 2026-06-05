# Protocol Import / Rewrite Workflow (v1)

## Concept

Upload a previously authored protocol **DOCX**. The system ingests the full document, then **rewrites each ICH M11 Template section from scratch** (not a section-by-section prose retrofit). Generated text is **proposal-only** until a human approves each section.

The uploaded DOCX remains a **reference artifact** after processing; it is not the editable protocol.

## Upload workflow

1. Toolbar → **Import Protocol**
2. Read overwrite warning; check confirmation checkbox
3. Drag/drop or choose `.docx` (PDF planned later)
4. **Continue** → staged processing animation
5. **Open review workspace** → per-section review and approval

## Persistence

| Data | Storage |
|------|---------|
| DOCX blob | IndexedDB `m11-studio-protocol-import` |
| Draft metadata | `localStorage` key `m11-protocol-import-v1` |
| Approved narrative | Protocol `elements[]` via `import.{sectionId}.narrative` |

## LLM boundary

`rewriteProtocolToM11Sections()` in `src/app/domain/protocol/import/rewriteProtocolToM11Sections.ts` — replace implementation when an LLM service is wired. v1 returns placeholder drafts.

## SoA

Section **1.3** keeps `viewKind: schedule-of-activities`. No SoA extraction in v1; visit/assessment/schedule layers are unchanged.

## Validation (v1)

On **Approve**: `validateGeneratedSectionDraft()` — template presence, title match, required text, terminology hook message. Non-blocking for narrative.
