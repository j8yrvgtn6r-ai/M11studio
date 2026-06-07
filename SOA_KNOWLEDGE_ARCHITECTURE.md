# SoA Knowledge Model Architecture (v1)

## Why SoA Knowledge exists

The Schedule of Activities (SoA) in clinical protocols is not merely a matrix grid. It is a structured schedule knowledge model that connects:

- **Arms** → **Epochs** → **Elements** → **Visits** → **Activities** → **Assessments / Procedures**
- **Timing windows**, **conditions**, **footnotes**, and **schedule rules**

M11 Studio already has:

1. **SoA Configuration UI** — authoritative authoring for visit definitions, assessment catalog, and schedule rules that drive the generated matrix.
2. **Knowledge Graph** — entity/relationship model for agents and consistency reasoning.
3. **Protocol narrative** — imported and generated M11 section text.

SoA Knowledge Model v1 introduces a **dedicated bridge layer** so future agents (including the SoA Agent) can reason about schedule structure without replacing existing configuration or matrix generation.

## Relationship to existing SoA Configuration

| Concern | SoA Configuration (existing) | SoA Knowledge Model (v1) |
|--------|------------------------------|----------------------------|
| Purpose | Authoritative schedule authoring | Structured schedule understanding |
| Storage | `ProtocolDocument` (`visitSchedule`, `soaAssessmentDefinitions`, `assessmentScheduleRules`) | `m11-soa-knowledge-v1` localStorage + optional Supabase |
| UI | Full SoA Configuration tabs + generated matrix | Read-only summary counts |
| Write path | User edits via SoA UI | Extraction + import refresh only |
| Overwrite behavior | N/A | **Never overwrites** SoA Configuration in v1 |

Adapter functions:

- `buildSoAKnowledgeFromExistingConfiguration()` — reads current protocol SoA entities
- `applySoAKnowledgeToExistingConfiguration()` — **guarded no-op** in v1
- `compareSoAKnowledgeToExistingConfiguration()` — parity diagnostics

## Relationship to Knowledge Graph

`soaKnowledgeGraphBridge.ts` maps SoA entities to Knowledge Graph patches:

| SoA entity | Knowledge entity type | Typical relationship |
|-----------|----------------------|----------------------|
| SoAArm | `arm` | `uses` / `has_intervention` (future) |
| SoAEpoch | `other` | `belongs_to` (visit/element → epoch) |
| SoAVisit | `visit` | `belongs_to` epoch |
| SoAActivity | `activity` | `related_to` visit |
| SoAAssessment | `assessment` | `scheduled_at` visit |
| SoAProcedure | `procedure` | `scheduled_at` visit |

v1 creates graph **patches only**. Import workflow optionally merges patches into the in-memory/localStorage Knowledge Graph. Supabase graph persistence remains optional.

## Relationship to protocol narrative

Deterministic extraction scans schedule-relevant M11 sections:

- `1.3` Schedule of Activities
- `4` Trial Design
- `6` Trial Intervention and Concomitant Therapy
- `8` Trial Assessments and Procedures
- `9` Adverse Events / Safety Reporting
- `10` Statistical Considerations (timing/analysis references)

Extraction produces visits, assessments (with categories), conditions, timing windows, footnotes, and **explicit** schedule rules only. Ambiguous timing is stored in diagnostics — not invented as rules.

`soaKnowledgeNarrativeSync.ts` provides deterministic **impact maps** for future bidirectional sync:

- Assessment schedule changes → sections `1.3`, `8`, optionally `9` / `10`
- Visit timing changes → `1.3`, `4`, `8`
- Intervention activity changes → `4`, `6`, `8`

v1 does **not** auto-rewrite narrative text or set review states.

## Domain module layout

```
src/app/domain/soa-knowledge/
  soaKnowledgeTypes.ts       — core types
  soaKnowledgePatch.ts       — merge/patch semantics (duplicate assessment merge)
  soaKnowledgeStore.ts       — in-memory + localStorage (`m11-soa-knowledge-v1`)
  soaKnowledgeBuilder.ts     — extraction + configuration bridge + import refresh
  soaKnowledgeSelectors.ts   — summaries and lookups
  soaKnowledgeGraphBridge.ts — Knowledge Graph patch bridge
  soaKnowledgeNarrativeSync.ts — narrative impact hooks
  useSoAKnowledge.ts         — React subscription hooks
  index.ts
```

## Import workflow hook

After import diagnostics are staged (`protocolImportProcessor.ts`):

1. `refreshSoAKnowledgeFromImport()` builds from section drafts + merges configuration entities
2. Build Console events: building model, extracted counts, model updated
3. Optional Knowledge Graph patch merge (non-blocking; failures logged as warnings)

This runs **after** first visible content is available and does not block the import dialog completion path.

## Supabase persistence (scaffold)

Migration `003_soa_knowledge.sql`:

- `soa_knowledge_models` — full model JSON snapshot
- `soa_entities` — normalized entity rows
- `soa_schedule_rules` — rule rows with foreign-key text references

Repositories (not wired to UI in v1):

- `SoAKnowledgeRepository`
- `SoAEntityRepository`
- `SoAScheduleRuleRepository`

Migrations are **manual apply only** — no Supabase credentials required for local development.

## UI visibility (v1)

Read-only **SoA Knowledge** summary panel:

- Study Model drawer (`StudyModelPanel`)
- Review Workspace knowledge tab (`ProtocolKnowledgePanel`)

Shows counts for arms, epochs, elements, visits, activities, assessments, schedule rules, conditions, plus extraction diagnostics when present.

## Future SoA Agent responsibilities

The SoA Agent (not implemented in v1) will:

1. Propose first-pass schedule structure from narrative + Knowledge Graph
2. Generate / refresh SoA matrix via existing configuration APIs
3. Detect narrative ↔ schedule out-of-sync conditions
4. Validate schedule completeness against M11 expectations
5. Map export artifacts to CDISC / sponsor templates

v1 intentionally scaffolds types, storage, extraction, bridges, and hooks so the agent can query and patch structured schedule knowledge without refactoring SoA Configuration.

## Future bidirectional sync

`soaKnowledgeNarrativeSync.ts` is the extension point for:

- SoA change → impacted narrative sections (+ reasons)
- Narrative section edit → impacted SoA fields
- Consistency Agent integration for out-of-sync marking (future)

## Known limitations (v1)

- Deterministic extraction only — no LLM inference
- No PDF/OCR ingestion path
- Epochs/elements from narrative are heuristic; configuration bridge is stronger for visits/assessments/rules
- `applySoAKnowledgeToExistingConfiguration()` is a guarded no-op
- Generated SoA matrix logic unchanged
- Supabase repositories exist but are not used by runtime UI
- Duplicate assessment names merge; visit dedup by normalized name on patch
- `resetProject()` and `resetImportWorkspace()` call `clearSoAKnowledge()` and `clearSoAProposal()` so stale knowledge and proposals do not survive New Project or replacement import

## SoA Agent v3 extensions

See [SOA_AGENT_V3_TABLE_EXTRACTION.md](./SOA_AGENT_V3_TABLE_EXTRACTION.md).

- `deterministic-table` inference source with table cell evidence coordinates
- `soaNarrativeSyncStore` — proposal-gated narrative sync records (localStorage)
- Table extraction modules: `soaTableExtractor`, `soaTableNormalizer`, `soaTableReconciliation`
- Import hook passes canonical document tables into `evaluateSoAScheduleExtraction`
