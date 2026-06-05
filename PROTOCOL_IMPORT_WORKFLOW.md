# Protocol Import / Rewrite Workflow

## Concept

Upload a previously authored protocol **DOCX**. The system extracts readable structure from the file, then **rewrites each ICH M11 Template section from scratch** (not a section-by-section prose retrofit). Generated text is **proposal-only** until a human approves each section.

The uploaded DOCX remains a **reference artifact** after processing; it is not the editable protocol.

## v2 PR 1 — Real DOCX extraction (current)

| Capability | Status |
|------------|--------|
| DOCX text / paragraph / table extraction | **Real** (mammoth + OOXML via JSZip) |
| Heading / section candidate detection | **Real** (Word styles, numbering, all-caps, whole-document fallback) |
| M11 section mapping hints | **Heuristic** (`possibleM11SectionId`) |
| LLM rewrite (`rewriteProtocolToM11Sections`) | **Mocked** — placeholder draft text |
| Narrative terminology harmonization | **Future** |

### Parsing libraries

- **mammoth** — raw text, HTML, tables
- **jszip** — read `word/document.xml` for paragraph styles and heading levels

### Extraction model

`ImportedProtocolSource` (full body in IndexedDB):

- `fullText`, `paragraphs[]`, `headings[]`, `sections[]` (source section candidates), `tables[]`, `extractionWarnings[]`

`SourceSectionCandidate`:

- `headingText`, `headingLevel`, `startIndex` / `endIndex`, `text`, `confidence`, `detectedNumber`, `possibleM11SectionId`, `detectionMethod`

Summary metadata (no `fullText`) in `localStorage` key `m11-protocol-import-v2`.

### Heading detection

1. Word paragraph styles (`Heading 1`…`Title`) from OOXML  
2. Numbered headings (`1`, `1.1`, `8.4.2`, …)  
3. All-caps lines (short, major headings)  
4. Fallback: single **whole-document** candidate + warning if none detected  

### Limitations

- Complex Word numbering (auto-number linked to `numbering.xml`) is not fully resolved  
- Tables depend on mammoth HTML conversion quality  
- M11 mapping is fuzzy token overlap, not semantic LLM alignment  
- Very large DOCX files may approach IndexedDB quota limits  

## Upload workflow

1. Toolbar → **Import Protocol**
2. Overwrite warning + confirmation checkbox
3. Upload `.docx` (PDF planned later)
4. Processing shows real extraction stats on steps 2–3
5. **Review workspace** → Section review + **Source extraction** tab

## Persistence

| Data | Storage |
|------|---------|
| DOCX blob | IndexedDB `m11-studio-protocol-import` / `source-documents` |
| Extracted source | IndexedDB / `extractions` |
| Draft + summary metadata | `localStorage` `m11-protocol-import-v2` |
| Approved narrative | Protocol `elements[]` via `import.{sectionId}.narrative` |

## Error handling

- **DOCX parse failure:** user-friendly error, no M11 drafts, DOCX artifact retained, retry from upload step  
- **No headings:** full text still extracted; whole-document source candidate created  

## SoA

Section **1.3** keeps `viewKind: schedule-of-activities`. No SoA extraction; schedule layers unchanged.

## LLM boundary

Replace `rewriteProtocolToM11Sections()` when an LLM service is wired. It already receives the real `ImportedProtocolSource` object and matched source candidate ids per section.
