# SoA Agent v2 — LLM Enrichment Layer

## Philosophy

```
Deterministic Extraction
        ↓
LLM Enrichment Proposal
        ↓
Human Review
        ↓
Accept / Reject
```

SoA Agent v2 adds an **enrichment layer** on top of v1 deterministic extraction. The LLM never directly mutates SoA Configuration, SoA Matrix, or SoA Knowledge. It produces a reviewable enrichment proposal.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| `soaAgentRules.ts` / `soaKnowledgeBuilder.ts` | Deterministic baseline extraction |
| `soaAgentEnrichment.ts` | Prompt building, LLM/fixture enrichment, evidence validation |
| `soaEnrichmentProposal.ts` | Proposal model + provenance types |
| `soaEnrichmentStore.ts` | localStorage proposal lifecycle (`m11-soa-enrichment-v1`) |
| `soaAgentEnrichmentRunner.ts` | Run/accept/reject orchestration, build console events |
| `SoAEnrichmentProposalReviewPanel.tsx` | Human review UI |

## Proposal model

`SoAEnrichmentProposal` stores:

- Provider/model metadata
- `deterministicCounts` vs `enrichedCounts`
- Proposed entity arrays (visits, assessments, procedures, activities, conditions, timing windows, schedule rules, footnotes)
- Diagnostics: `hallucinationRiskWarnings`, `unsupportedInferenceWarnings`, `missingEvidenceWarnings`, `conflictingScheduleStatements`
- `rationaleEntries`, `sourceSectionIds`, `impactedNarrativeSections`
- Deferred `knowledgePatch` / `configurationPatch` (computed at proposal time, applied only on accept)

## Provenance

`SoAInferenceSource`:

- `deterministic`
- `llm-inferred`
- `llm-reconciled`
- `user-created`
- `user-modified`

Every enriched entity carries `inferenceSource`, `evidence[]`, and optional `rationale`. Provenance survives acceptance into SoA Knowledge and Knowledge Graph entity metadata.

## Evidence model

`SoAEvidenceReference`:

- `sectionId`
- `sourceText` (must appear in section text)
- `reason`

Items without valid evidence are **discarded** and never proposed.

## Prompt design

`buildSoAEnrichmentPrompt()` sends:

1. Deterministic extraction snapshot
2. SoA Knowledge summary counts
3. Knowledge Graph summary
4. Relevant protocol sections (1.3, 4, 6, 8, 9, 10)

The model must return JSON matching:

```json
{
  "visits": [],
  "assessments": [],
  "procedures": [],
  "activities": [],
  "timingWindows": [],
  "conditions": [],
  "footnotes": [],
  "scheduleRules": [],
  "rationale": [],
  "warnings": []
}
```

Malformed JSON is rejected safely; fixture fallback is used when no API key is configured.

## UI workflow

**Run LLM SoA Enrichment** appears in:

- SoA Configuration header
- Review Workspace (Protocol Knowledge panel)
- SoA Knowledge summary panel

Actions:

1. Run enrichment → create proposal → open review panel
2. Accept → merge into SoA Knowledge + Knowledge Graph + optional additive configuration patch
3. Reject → preserve current SoA Knowledge

## Knowledge Graph integration

Accepted enrichment items create graph entities with `metadata.inferenceSource` and relationships:

- `scheduled_at` (assessment/procedure → visit)
- `belongs_to`, `uses`, `related_to`
- `requires` (condition → assessment)

## Narrative impact

On accept, `impactedNarrativeSections` flow through the existing Consistency Agent path (`applyConsistencyAgentResults`). No auto-rewrite.

## Build console events

- SoA LLM enrichment started
- Analyzing schedule structure
- Reconciling schedule entities
- Generated enrichment proposal
- Proposed: X visits, Y assessments, Z rules
- SoA LLM enrichment completed

## Storage

- Runtime: `m11-soa-enrichment-v1` localStorage
- Prepared (not wired): `SoAEnrichmentProposalRepository` → `soa_enrichment_proposals` table scaffold

Reset hooks (`resetProject`, `resetImportWorkspace`) clear enrichment proposals alongside SoA Knowledge and v1 proposals.

## Tests

Run: `npm run test:soa-enrichment`

## Known limitations (v2)

- Enrichment uses fixture provider when no LLM credentials configured
- No PDF/OCR ingestion
- No autonomous schedule generation
- No auto-accept
- Supabase enrichment persistence prepared but not wired
- Graph relationship vocabulary limited to existing `KnowledgeRelationshipType` union (`requires` used for conditional links)

## SoA Agent v3 status

**Implemented** — see [SOA_AGENT_V3_TABLE_EXTRACTION.md](./SOA_AGENT_V3_TABLE_EXTRACTION.md).

v3 delivers table-aware DOCX extraction, matrix proposal preview, narrative/table reconciliation, and narrative sync proposals. Items below remain for v4+:

1. **PDF digital text extraction** — share normalization pipeline with DOCX
2. **OCR fallback** — scanned PDF only, proposal-gated
3. **Supabase audit trail wiring** — repositories scaffolded in v3
4. **Multi-slice LLM enrichment** — parallel slices with partial failure tolerance
