# SoA Agent Architecture (v1)

## Purpose

The **SoA Agent** (`soa-agent`) produces a **first-pass Schedule of Activities structure** from protocol narrative, the SoA Knowledge Model, and the Knowledge Graph. It does not replace SoA Configuration authoring or directly mutate the generated SoA matrix.

Core principle: **propose first, review second, apply on accept.**

## Input sources

| Source | Use in v1 |
|--------|-----------|
| Protocol section drafts (1.3, 4, 6, 8, 9, 10) | Primary deterministic extraction |
| SoA Knowledge Model | Merge baseline / dedupe on repeat runs |
| Knowledge Graph | Context for future enhancements (read-only in rules) |
| Core / Study Model | Optional context (not required for extraction) |
| Existing SoA Configuration | Comparison + safe configuration patch proposals |

### Triggers

`import`, `manual`, `sectionEdit`, `validationAccepted`, `regenerateSoA`, `generateFirstPass`, `syncFromNarrative`, `syncFromSoAEdit`

## Agent modules

```
src/app/agents/
  SoAAgent.ts           — agent registration + build console events
  soaAgentRules.ts      — deterministic extraction + proposal assembly
  soaAgentRunner.ts     — run/accept/reject orchestration
```

Agent id: **`soa-agent`**

## Output model

`SoAAgentOutput`:

- `soaKnowledgePatch` — entities to merge into SoA Knowledge on accept
- `proposedConfigurationPatch` — new visits/assessments/rules for SoA Configuration (additive only)
- `extractedItems`, `proposedScheduleRules`
- `impactedNarrativeSections`, `diagnostics`, `warnings`, `skippedItems`
- `summary`

## Proposal model

Persisted locally (`m11-soa-proposal-v1`):

```typescript
SoAProposal {
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded'
  soaKnowledgePatch
  configurationPatch?
  impactedNarrativeSections[]
  diagnostics[], warnings[]
  counts { visits, assessments, scheduleRules, ... }
}
```

Store API: `createSoAProposal`, `getCurrentSoAProposal`, `acceptSoAProposal`, `rejectSoAProposal`, `supersedeSoAProposal`

**Import and manual runs create proposals — they do not auto-apply.**

## Proposal accept / reject flow

### Accept (`acceptCurrentSoAProposal`)

1. Patch SoA Knowledge Model (`patchSoAKnowledge`)
2. Apply configuration patch safely (`applySoAConfigurationPatchSafely`) — adds new visits/assessments/rules only
3. Merge Knowledge Graph patch (`buildKnowledgeGraphPatchFromSoAKnowledge` → `patchKnowledgeGraph`)
4. Mark impacted narrative sections out-of-sync via `applyConsistencyAgentResults` when import drafts exist
5. Mark proposal `accepted` + build console event

### Reject (`rejectCurrentSoAProposal`)

- Preserves existing SoA Knowledge + Configuration
- Marks proposal `rejected` + build console event

## Relationship to SoA Knowledge Model

- Extraction rules live in `soaAgentRules.ts` and reuse `buildSoAKnowledgeFromProtocolSections`
- Extra patterns: tumor imaging, hematology/chemistry, end of treatment, interval timing diagnostics
- Duplicate assessments/visits merge by normalized name on repeat runs

## Relationship to existing SoA Configuration

- `buildProposedConfigurationPatch` maps knowledge entities → configuration entities
- `applySoAConfigurationPatchSafely` uses existing mutation helpers (`createSoAAssessmentDefinition`, `createAssessmentScheduleRule`, `mutateProtocolDocument` for visits)
- Never deletes or overwrites user-authored configuration in v1

## Relationship to Knowledge Graph

On accept:

- `scheduled_at` (assessment/procedure → visit)
- `belongs_to` (visit/element → epoch)
- `uses` (element → arm)
- `related_to` (activity → visit)

No Supabase required — local graph store only.

## Narrative sync

Uses `soaKnowledgeNarrativeSync` helpers to compute impacted M11 sections. On accept, Consistency Agent result application marks available import drafts `outOfSync` with structured impact records. **No automatic narrative rewrite.**

## UI surfaces (v1)

| Location | Feature |
|----------|---------|
| Study Model drawer | SoA Knowledge summary + Generate First-Pass SoA + Review Proposal |
| Review Workspace (Protocol knowledge tab) | Same actions + proposal review panel |
| SoA Configuration header | Compact Generate / Review actions |

Component: `SoAProposalReviewPanel.tsx`

## Import workflow

After import diagnostics in `protocolImportProcessor.ts`:

```typescript
await runSoAAgentFromImport(draftRecord);
```

Build console events (via agent):

- SoA Agent started
- Extracting visits / assessments / schedule rules
- SoA proposal created
- Counts + SoA Agent completed

Non-blocking — does not delay first visible protocol content.

## Future enhancements

- LLM-assisted extraction for ambiguous tables and nested SoA layouts
- Bidirectional narrative sync (SoA edit → section regeneration)
- Supabase persistence for proposals and audit trail
- Full configuration merge with change-control versioning
- SoA matrix preview inside proposal review (without direct matrix mutation)

## Known limitations (v1)

- Deterministic extraction only — no LLM
- No PDF/OCR
- Visit creation requires existing schedule anchor in protocol document
- Configuration patch is additive; complex edits remain manual in SoA Configuration UI
- Generated SoA matrix unchanged until configuration entities exist and cache regenerates via existing mutation hooks
- Proposal history capped at 50 entries in localStorage

## SoA Agent v3 (implemented)

See [SOA_AGENT_V3_TABLE_EXTRACTION.md](./SOA_AGENT_V3_TABLE_EXTRACTION.md).

- Table-aware DOCX schedule extraction from Canonical Document + `ExtractedTable[]`
- Narrative/table reconciliation (`reconcileNarrativeAndTableSoAKnowledge`)
- Matrix proposal preview (read-only until accept)
- Narrative sync proposals after accept; narrative edit refresh diagnostics
- PDF/OCR provider stubs only (not implemented)
- Supabase audit scaffolds: `SoAProposalAuditRepository`, `SoATableExtractionRepository`
