# Protocol Import / Rewrite Workflow

## Concept

Upload a previously authored protocol **DOCX**. The system extracts structure, builds a **Protocol Knowledge Layer**, and generates **M11 section proposals** mapped to the ICH M11 Template. Generated text is **proposal-only** until a qualified reviewer approves each section.

The uploaded DOCX remains a **reference artifact**; it is not the editable protocol.

## v2 PR 3 — LLM protocol understanding + M11 generation (current)

| Capability | Status |
|------------|--------|
| Protocol understanding | **LLM provider boundary** (OpenAI/Azure) + **fixture** for smoke/dev |
| M11 section generation | **Reconstruction** from `ProtocolKnowledgeModel` (not section mapping) |
| Generation provenance | **Stored per draft** (provider, model, prompt version, knowledge elements) |
| Post-generation validation | **Non-blocking** structural + terminology suggestions |
| Regenerate section | **Async** — supersedes prior version in history |
| Version commits | Understanding, M11 generation, regeneration, approval |

### LLM configuration

| Variable | Purpose |
|----------|---------|
| `VITE_PROTOCOL_LLM_PROVIDER` | `openai` \| `azure-openai` \| `fixture` (default: fixture without API key) |
| `VITE_OPENAI_API_KEY` | OpenAI API key |
| `VITE_OPENAI_MODEL` | Model id (default `gpt-4o-mini`) |
| `localStorage m11-protocol-llm-provider` | Runtime override |

### Architecture

```
Uploaded DOCX → Extraction → Protocol Understanding (LLM) → ProtocolKnowledgeModel → M11 Generation (LLM) → Review
```

## v2 PR 2 — Knowledge layer, state machine, versioning

| Capability | Status |
|------------|--------|
| DOCX extraction | **Real** (mammoth + JSZip) |
| Protocol Knowledge Layer | **Local deterministic** (`buildProtocolKnowledgeModel`) |
| M11 section drafts | **Local deterministic** (`rewriteProtocolToM11Sections`) — not AI-generated |
| Section review state machine | **Formal** (`SectionReviewState` + `stateHistory`) |
| Version / commit scaffold | **Local** (`ProtocolCommit`, `ProtocolVersion`) |
| Archive export | **JSON download** (Export M11 Studio Archive) |
| LLM providers | **Boundary only** — not configured |
| Version diff UI | **Scaffold** — Compare Versions coming soon |
| Cloud auth / team permissions | **Future** — see `VERSIONING_ARCHITECTURE.md` |
| Narrative terminology harmonization | **Future** |

### Protocol Knowledge Layer

`ProtocolKnowledgeModel` summarizes the uploaded protocol globally before section generation:

- Scalar fields: study title, sponsor, protocol ID, phase, indication, population, etc. (when pattern-matched in DOCX text)
- Lists: objectives, endpoints, estimands, arms, interventions, safety/efficacy assessments
- `knowledgeProvider`: `local-deterministic` (UI shows this explicitly; not LLM-generated)

Provider boundary: `buildProtocolKnowledgeModel(sourceExtraction)` — swap for LLM implementer later.

### M11 rewrite provider

```typescript
rewriteProtocolToM11Sections({
  sourceExtraction,
  protocolKnowledgeModel,
  m11TemplateSections,
  m11TechnicalSpecification,
  controlledTerminology,
  artifact,
  generationProvider: 'local-deterministic',
})
```

Draft text is transparently assembled from knowledge + source candidates. `generationProvider` is shown in the UI.

### Section review state machine

States: `generated` → `pendingReview` → `inReview` → `validationPending` → `validationPassed` | `validationFailed`; also `changesRequested`, `superseded`.

- Import completes with drafts in `pendingReview`
- Opening review → `inReview`
- Approve → `validationPending` → validation → `validationPassed` or `validationFailed`
- Request Changes → `changesRequested`
- Regeneration supersedes prior draft version

Human-in-loop: approval triggers validation; validation does not replace approval.

### Versioning

Local Git-inspired commits on import complete, import overwrite, and section approval. **Version History** tab lists commits. See `VERSIONING_ARCHITECTURE.md` for hosted roadmap.

### Persistence

| Data | Storage |
|------|---------|
| DOCX blob | IndexedDB `source-documents` |
| Extracted source | IndexedDB `extractions` |
| Import + knowledge + drafts | `localStorage` `m11-protocol-import-v3` |
| Commits / version | `localStorage` `m11-protocol-versioning-v1` |
| Approved narrative | `import.{sectionId}.narrative` elements |

### Review workspace tabs

1. Section review  
2. Protocol knowledge  
3. Source extraction  
4. Version history  

**Export Archive** in review header downloads full workspace JSON.

## v2 PR 1 — DOCX extraction (foundation)

See git history / prior docs for mammoth, heading detection, and extraction model details.

## SoA

Section **1.3** — `schedule-of-activities`. No SoA extraction from DOCX.

## Error handling

- DOCX parse failure: error shown, no drafts, artifact retained  
- No headings: whole-document fallback candidate + warning  
