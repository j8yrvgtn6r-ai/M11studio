# SoA Builder v1 Architecture

**Status:** Implemented (manual + agent-assisted SoA builder)  
**Scope:** SoA Configuration workspace, SoA Knowledge model, Knowledge Graph bridge, narrative sync proposals  
**Reference model:** [OpenStudyBuilder](https://www.openstudybuilder.com/) study structure hierarchy

---

## 1. Purpose

SoA Builder v1 upgrades SoA Configuration from mostly agent-generated output into a **manual + agent-assisted** authoring experience. Authors can add, edit, and delete study structure entities while keeping bidirectional sync across:

```
Protocol narrative text ⇄ Knowledge Graph ⇄ SoA Knowledge ⇄ SoA Configuration ⇄ future USDM JSON
```

Agent-generated data is never overwritten silently; manual edits carry `user-created` or `user-modified` provenance.

---

## 2. Study structure model

OpenStudyBuilder-inspired hierarchy (`soaStudyStructureModel.ts`):

```
Study Structure
  → Epochs
  → Arms
  → Elements
  → Visits
  → Activities / Assessments
  → Schedule Rules
  → Milestones
  → Conditional Logic
```

| Layer | SoA Knowledge collection | SoA Configuration / protocol store |
|-------|--------------------------|-------------------------------------|
| Epochs | `epochs[]` | (knowledge-only in v1) |
| Arms | `arms[]` | (knowledge-only in v1) |
| Elements | `elements[]` | (knowledge-only in v1) |
| Visits | `visits[]` | `visitSchedule.visitDefinitions[]` |
| Activities | `activities[]` | (knowledge-only in v1) |
| Assessments | `assessments[]` | `soaAssessmentDefinitions[]` |
| Schedule Rules | `scheduleRules[]` | `assessmentScheduleRules[]` |
| Milestones | `milestones[]` | `visitSchedule.anchors[]` |
| Conditional Logic | `conditions[]` | (knowledge-only in v1) |

---

## 3. Readiness gating

### Generate First-Pass SoA

Hidden unless **any** of:

- Knowledge Graph has meaningful protocol entities (arm, visit, activity, assessment, …), **or**
- Core Study Model exists, **or**
- Relevant sections have imported or manual content: `1.3`, `4`, `6`, `8`, `9`, `10`

Implementation: `evaluateSoAFirstPassReadiness()` in `soaReadinessEvaluator.ts`.  
UI: `SoAProposalReviewPanel` / `useSoAReadiness`.

### Run LLM SoA Enrichment

Hidden unless **all** of:

- First-pass SoA exists (proposal, knowledge, or configuration schedule content)
- Deterministic SoA extraction has run (deterministic provenance or populated schedule entities)
- SoA Knowledge has visits, assessments, or schedule rules

Implementation: `evaluateSoAEnrichmentReadiness()`.  
UI: `SoAEnrichmentProposalReviewPanel`.

---

## 4. Manual authoring flow

### Entry points

- **Entity tabs** (`SoAKnowledgeEntityTab`): epochs, arms, elements, visits, activities, assessments, milestones, conditional logic
- **Schedule rules tab** (`SoAConfigurationScheduleRulesPanel`): assessment × visit intersections
- **Entity editor dialog** (`SoAEntityEditorDialog`): shared Add/Edit form with validation

### Save pipeline (`saveManualSoAEntity`)

1. Validate form (`validateSoAEntityForm`)
2. Patch SoA Knowledge (`applySoAKnowledgePatch` + merge preserving agent provenance)
3. Patch SoA Configuration where applicable (visits, assessments, rules, anchors)
4. Sync Knowledge Graph (`applySoAKnowledgeGraphPatchSafely` → `patchKnowledgeGraph`)
5. Create narrative sync proposal (no auto-rewrite)

### Delete pipeline (`deleteManualSoAEntity`)

- Removes configuration rows when safe (blocks delete when rules reference visit/assessment)
- Removes entity from SoA Knowledge
- Re-syncs Knowledge Graph
- Flags narrative sections for review

### Provenance

| Source | Meaning |
|--------|---------|
| `user-created` | New manual entity |
| `user-modified` | Manual edit of existing entity (agent rows keep evidence, source becomes `user-modified`) |
| `deterministic` / `llm-inferred` | Agent-generated; preserved unless explicitly edited |

---

## 5. Knowledge Graph relationships

`soaKnowledgeGraphBridge.ts` emits:

| Relationship | Semantics |
|--------------|-----------|
| `scheduled_at` | Assessment/activity scheduled at visit |
| `belongs_to` | Entity belongs to epoch/arm/element |
| `occurs_during` | Visit/activity occurs during epoch |
| `uses` | Activity uses assessment/procedure |
| `requires` | Rule requires assessment at visit |
| `condition_applies_to` | Condition gates visit/activity/assessment/rule |

---

## 6. Narrative sync (no auto-rewrite)

After manual SoA edits, `markManualEditNarrativeImpact()`:

1. Builds impact record via `createSoANarrativeImpactRecord`
2. Creates proposal via `createSoANarrativeSyncProposal({ source: 'soaEdit', … })`
3. Suggested note: *"This SoA change may require updates to Section X."*
4. Applies consistency flags when import drafts exist (`applyConsistencyAgentResults`)

Impacted sections: `1.3`, `4`, `6`, `8`, `9`, `10`.

UI surfaces proposal in `SoAKnowledgeEntityTab` via narrative sync warning badge.

---

## 7. Validation

### Form validation (`soaEntityValidation.ts`)

- Required fields per entity kind
- Duplicate name warnings within collection
- Visit requires anchor; schedule rule requires assessment + visit
- Invalid timing/window patterns (warnings)

### Integrity validation (`soaKnowledgeIntegrity.ts`)

- Visit has valid epoch / milestone references
- Element has epoch/arm where set
- Schedule rule has visit + assessment/activity
- Orphan assessments (scheduled nowhere)
- Scheduled assessment not described in Section 8 narrative (warning)

---

## 8. UI components

| Component | Role |
|-----------|------|
| `SoAConfigurationShell` | Tab rail including milestones |
| `SoAKnowledgeEntityTab` | List + Add/Edit/Delete, provenance badge, KG sync badge, narrative warning |
| `SoAEntityEditorDialog` | Shared entity form |
| `SoAProposalReviewPanel` | First-pass gating |
| `SoAEnrichmentProposalReviewPanel` | Enrichment gating |

Empty states guide authors to manual add or first-pass generation when readiness allows.

---

## 9. Tests

| Script | Coverage |
|--------|----------|
| `npm run test:soa-builder-v1` | Gating, CRUD, KG sync, narrative proposal, integrity validation |
| `npm run test:soa-manual-authoring-ux` | Prior manual authoring UX tests |
| `npm run test:soa-knowledge` | Knowledge model unit tests |
| `npm run test:soa-agent` | Agent pipeline tests |

---

## 10. Limitations (v1)

- Epochs, arms, elements, activities, and conditions are knowledge-first; not all fields mirror `clinicalDesign` yet
- Visits tab still uses `SoAConfigurationVisitsSchedulePanel` alongside knowledge entity tab
- USDM JSON export is reserved (`SOA_BUILDER_SYNC_TARGETS.futureUsdmJson`)
- Narrative sync proposes updates only; does not rewrite section text
- Schedule rules tab edit/delete parity is partial compared to entity tabs

---

## 11. Key files

```
src/app/domain/soa-knowledge/
  soaStudyStructureModel.ts      — hierarchy + narrative sections
  soaManualAuthoringService.ts   — save/delete + KG + narrative sync
  soaKnowledgeIntegrity.ts       — cross-layer validation
  soaReadinessEvaluator.ts       — first-pass + enrichment gating
  soaKnowledgeGraphBridge.ts     — KG patch builder
  soaEntityValidation.ts         — form validation

src/app/components/soa-configuration/
  SoAKnowledgeEntityTab.tsx
  SoAEntityEditorDialog.tsx
  SoAConfigurationShell.tsx
  useSoAReadiness.ts

scripts/test-soa-builder-v1.ts
```
