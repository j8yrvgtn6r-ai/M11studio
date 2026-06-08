# SoA Manual Authoring UX

Manual SoA Configuration workflows with readiness gating, entity editors, persistence, and narrative sync impact tracking.

## Readiness gating

### First-pass SoA generation

`evaluateSoAFirstPassReadiness()` in `src/app/domain/soa-knowledge/soaReadinessEvaluator.ts` evaluates:

- Core Study Model (`getStudyModel`, `getStudyModelPhase`)
- Knowledge Graph meaningful entities
- Imported or manually authored content in sections `1.3`, `4`, `6`, `8`, `9`, `10`

**Generate First-Pass SoA** is shown only when both are true:

1. Core Study Model exists **or** Knowledge Graph has meaningful entities **or** (implicit via section content path) protocol knowledge signal exists
2. At least one relevant section has imported or manually authored content

When not ready, the shell shows:

> Add protocol content or import a protocol before generating a first-pass SoA.

### LLM enrichment

`evaluateSoAEnrichmentReadiness()` requires:

- First-pass SoA proposal/model or accepted configuration/knowledge
- SoA Knowledge with at least one visit, assessment, or schedule rule
- Deterministic extraction baseline (knowledge populated from extraction or manual authoring)

When not ready, **Run LLM SoA Enrichment** renders disabled with tooltip:

> Generate a first-pass SoA before running LLM enrichment.

## Manual add/edit flows

### Tabs and + Add actions

| Tab | Button | Entity kind |
|-----|--------|-------------|
| Epochs | + Add Epoch | `epoch` |
| Arms | + Add Arm | `arm` |
| Visits | + Add Visit | `visit` |
| Activities | + Add Activity | `activity` |
| Elements | + Add Element | `element` |
| Assessments | + Add Assessment (existing catalog flow + knowledge sync) | `assessment` |
| Conditional Logic | + Add Condition / Rule | `condition` |
| Visits → Schedule Rules | + Add Schedule Rule | `scheduleRule` |
| Matrix | No direct add | — |

### SoAEntityEditorDialog

Reusable modal at `src/app/components/soa-configuration/SoAEntityEditorDialog.tsx` with entity-specific fields and validation.

### Persistence

`saveManualSoAEntity()` in `src/app/domain/soa-knowledge/soaManualAuthoringService.ts`:

- Patches **SoA Knowledge** with `user-created` / `user-modified` provenance
- Patches **SoA Configuration** for assessments, visits, and schedule rules
- Patches **Knowledge Graph** via `applySoAKnowledgeGraphPatchSafely`
- Preserves agent-generated provenance (`deterministic`, `llm-inferred`) by marking edits `user-modified` instead of overwriting evidence

### Narrative sync

Manual saves call `createSoANarrativeImpactRecord()` and `applyConsistencyAgentResults('soa-configuration', …)` when import drafts exist for impacted sections (`1.3`, `4`, `6`, `8`, `9`, `10`). Narrative text is **not** auto-rewritten.

## Validation

`validateSoAEntityForm()` enforces:

- Required name
- Visit → anchor linkage
- Schedule rule → assessment + visit linkage
- Duplicate name warnings (non-blocking)
- Invalid timing/window warnings (non-blocking)

## Empty states

Each tab renders a dashed empty state with guidance to add manually or generate first-pass SoA when protocol knowledge is available.

## Tests

```bash
npm run test:soa-manual-authoring-ux
```

Also run the standard SoA and smoke verification suite after changes.

## Known limitations

- Matrix tab has no direct add (schedule rules drive matrix cells)
- Conditional logic tab uses knowledge-only conditions (no clinical design decision engine yet)
- Narrative sync flags import drafts only when section drafts exist in the import workspace
- Visit anchor auto-creates a default screening anchor when none exists
- Assessments tab retains the existing catalog editor; knowledge sync uses parallel IDs
