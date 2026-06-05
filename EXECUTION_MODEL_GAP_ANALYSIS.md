# Execution Model Gap Analysis

**Status:** Planning (no implementation plan changes)  
**Authority:** Compares current M11 Studio implementation to [PROTOCOL_EXECUTION_MODEL_ARCHITECTURE.md](./PROTOCOL_EXECUTION_MODEL_ARCHITECTURE.md)  
**Baseline:** Stage 2d–2e complete (`1b00147` — SoA Assessment Definitions CRUD; UX refinement pass for horizontal tabs and workflow shell)  
**Does not modify:** [STAGE_2_IMPLEMENTATION_PLAN.md](./STAGE_2_IMPLEMENTATION_PLAN.md) until explicitly adopted

---

## 1. Executive summary

The **current implementation** delivers a valid **Assessment × Visit** source model with **generated SoA as a read-only rollup**. That work **survives** execution-model refinement: visit schedule, SoA assessment catalog, assessment schedule rules, schedule cache regeneration, validation, and parity remain the foundation.

The **gap** is not “wrong matrix math” but **missing execution layers** between clinical design and the matrix—especially **visit-scoped activities**, **arm-scoped views**, **column header trees**, and **hierarchy-aware CPL / narrative targets**.

**Recommended path:** Phases A → D (minimal disruption → activity → arm-aware → CPL) at the end of this document.

---

## 2. Layer-by-layer analysis

### 2.1 Arm

| Dimension | Assessment |
|-----------|------------|
| **Current implementation status** | **Partial.** `clinicalDesign.studyArms[]` exists as `DesignEntity` rows. `armRestrictions` optional on `visitSchedule.visitDefinitions` and `assessmentScheduleRules`. No `activeArmId` on document or generator. Matrix shows **merged** schedule for all arms. |
| **Existing assets to reuse** | Study arms in seed and graph; `ScheduleCondition.armIds`; rule/visit `armRestrictions`; dependency graph arm nodes; SoA Configuration **Arms** placeholder tab. |
| **Missing domain types** | `ArmSchedulePathway` or arm-scoped visit template sets; default `activeArmId` for authoring/export; arm-level schedule metadata on `document.schedule`. |
| **Missing UI** | Arm selector in SoA shell; arm-filtered matrix tab; arm-scoped visit/rule editors; cross-arm diff in Change Control. |
| **Migration complexity** | **Medium.** Filtering existing rules by `armRestrictions` is a Phase C stepping stone; full arm-specific visit catalogs is **High**. |
| **Dependencies** | Visit definitions and rules stable; generator supports filter predicate; CPL (Phase D) needs arm switch targets. |

**Stage 2 survival:** ✅ Arms as clinical design entities and restriction fields remain valid; generation adds filtering, not replacement.

---

### 2.2 Epoch

| Dimension | Assessment |
|-----------|------------|
| **Current implementation status** | **Partial.** `clinicalDesign` epochs as design entities; optional `visitDefinition.epoch` string on visits. No `columnHeaderTree`; epoch not a first-class grouping object in visit schedule. |
| **Existing assets to reuse** | Epoch entities in clinical design; visit `epoch` field; overview stats counting unique epochs from visits; **Epochs** placeholder tab. |
| **Missing domain types** | `ColumnHeaderNode` tree (epoch → cycle group → visit leaf); visit `headerPath` refs; epoch-to-visit-template bindings. |
| **Missing UI** | Epoch editor; grouped matrix column headers; epoch filter on visits list. |
| **Migration complexity** | **Medium** for display-only grouping from `visit.epoch`; **High** for nested “Treatment → Cycles 1–8 → Day n” trees. |
| **Dependencies** | Visit catalog complete; matrix UI supports multi-level headers. |

**Stage 2 survival:** ✅ `visitDefinition.epoch` and clinical design epochs remain; generator enriches visit metadata for UI.

---

### 2.3 Element

| Dimension | Assessment |
|-----------|------------|
| **Current implementation status** | **Partial.** `clinicalDesign` elements (and related collections) plus `relationships` for graph linkage. Elements do **not** drive visit templates or activity packs. |
| **Existing assets to reuse** | Design entities, `sectionRef`, dependency graph; **Elements** placeholder tab; narrative `linkedSectionId` patterns on assessments. |
| **Missing domain types** | `ElementScheduleScope` linking element → visit template IDs → allowed activities; subject pathway element state (future). |
| **Missing UI** | Element editor with linked visit templates; “apply template pack” workflow; element transition CPL preview. |
| **Migration complexity** | **High** — requires activity + visit template model first. |
| **Dependencies** | Activities (Phase B); visits; CPL for element transition (Phase D). |

**Stage 2 survival:** ✅ Clinical design elements unchanged; execution layer references them later.

---

### 2.4 Visit

| Dimension | Assessment |
|-----------|------------|
| **Current implementation status** | **Strong (Stage 2 core).** `visitSchedule.anchors[]`, `visitSchedule.visitDefinitions[]` with anchors, windows, re-anchor/ripple/missed policies, `soaColumnId`, display metadata, `clinicalDesignVisitId`. Read-only **Visits** UI with Schedule sub-tab (post–workflow PR). |
| **Existing assets to reuse** | Full visit schedule mutations (windows, policies, anchors); validation; selectors; `generateScheduleFromRules` visit axis; visit CRUD smoke tests. |
| **Missing domain types** | Column header tree; arm-scoped visit definition sets; unscheduled visit factory from CPL. |
| **Missing UI** | Visit **authoring** (edit/create); Schedule Rules sub-tab editor (placeholder only today); arm-scoped visit list. |
| **Migration complexity** | **Low** for header metadata; **Medium** for arm-scoped visit duplicates per arm. |
| **Dependencies** | None for continued visit-only rules; activities attach under visits in Phase B. |

**Stage 2 survival:** ✅ **Fully retained** — visit schedule is the X-axis authority for matrix rollup.

---

### 2.5 Activity

| Dimension | Assessment |
|-----------|------------|
| **Current implementation status** | **Weak / conflated.** `clinicalDesign.assessments` holds **clinical** assessment entities (WHAT), not operational visit activities. `performed-at` relationships link assessments to clinical design visits. **No** `visitActivityDefinitions` or ordered activity list per `visitDefinitionId`. |
| **Existing assets to reuse** | Clinical design assessments; graph relationships; **Activities** placeholder tab; `relativeTiming` on rules (coarse intra-visit hint). |
| **Missing domain types** | `VisitActivityDefinition` (id, visitDefinitionId, label, order, offsetMinutes, durationMinutes, resources?); `AssessmentPlacement` (`assessmentId` + `activityId` + scope). |
| **Missing UI** | Per-visit activity list; activity ordering (DnD); assessment placement under activity; activity timeline view. |
| **Migration complexity** | **High** — new collection + generator rollup + migration of 44 seed rules to default activity bucket. |
| **Dependencies** | Visit catalog; SoA assessment catalog; generator rollup spec (see §4). |

**Stage 2 survival:** ✅ Current rules remain valid via **default activity per visit** shim (Phase B).

---

### 2.6 Assessment

| Dimension | Assessment |
|-----------|------------|
| **Current implementation status** | **Strong for SoA rows.** `soaAssessmentDefinitions[]` with CRUD, validation, optional `clinicalDesignAssessmentId`, `linkedSectionId`. **Assessments** tab + Metadata panel; simplified create dialog (auto-id, category dropdown). Distinct from `clinicalDesign.assessments`. |
| **Existing assets to reuse** | `soaAssessmentDefinitionMutations`; validation module; `soaAssessmentValidationIndex`; impact helpers; assessment CRUD smoke tests; authoring context. |
| **Missing domain types** | `AssessmentPlacement` as first-class (vs rule tuple); optional `description` on catalog row (not in type today). |
| **Missing UI** | Placement UI under activities; hide advanced ids in default views (done for table; metadata technical section optional). |
| **Migration complexity** | **Low** for continued catalog CRUD; **Medium** when placements split from flat rules. |
| **Dependencies** | Activity layer for Assessment × Activity source; rules remain rollup input until Phase B complete. |

**Stage 2 survival:** ✅ **Fully retained** — catalog is Y-axis authority for matrix.

---

## 3. Cross-cutting analyses

### 3.1 Does current Stage 2 work survive execution-model refinement?

| Asset | Survives? | Notes |
|-------|-----------|-------|
| `visitSchedule` + mutations | ✅ | Becomes visit template layer under arm/element scope |
| `soaAssessmentDefinitions` + CRUD | ✅ | Remains SoA row catalog |
| `assessmentScheduleRules` | ✅ | Transitional Assessment × Visit source; maps to default activity placements |
| `generateScheduleFromRules()` | ✅ | Gains rollup + optional filters; output shape can stay stable |
| `document.schedule` cache | ✅ | Remains Layer C projection |
| Parity / `validateProtocol` | ✅ | Extend with new warnings, don’t break existing |
| Assessment × Visit UI matrix | ✅ | Becomes **Matrix** tab rollup view per arm |
| OSB/activity-centric authoring | ❌ | Requires Phase B+ |

**Conclusion:** Stage 2 is the **correct substrate**. Refinement **adds** Layer B structure; it does not invalidate Stage 2d–2e.

---

### 3.2 Assessment × Visit rules → Assessment × Activity placement

| Approach | Description |
|----------|-------------|
| **Today** | `AssessmentScheduleRule { assessmentId, visitDefinitionId, … }` |
| **Target** | `AssessmentPlacement { assessmentId, visitDefinitionId, activityId, … }` |
| **Transition** | (1) Add optional `activityId` on rules or parallel `placements[]`. (2) If absent, assign implicit activity `visit-{id}-default`. (3) Generator rolls up placements → same cells as today. (4) UI authors at activity level; export still shows visit×assessment. |
| **Rule evolution** | Deprecate direct rule authoring gradually; **Schedule Rules** sub-tab under Visits becomes **placement** editor. |

**Compatibility:** Seed `assessmentScheduleRules[44]` need no immediate change if generator implements default activity bucket.

---

### 3.3 Generated SoA as rollup projection

| Projection aspect | Current | Target |
|-------------------|---------|--------|
| Rows | `soaAssessmentDefinitions` + rules | Unchanged rollup from placements |
| Columns | `visitDefinitions` | + optional `headerPath` for nested headers |
| Cells | Rule-derived required/optional | Rollup: any placement at visit → present |
| Arm | Implicit merge | **Explicit `metadata.activeArmId`** filter |
| Activity detail | Lost in cell | Optional sub-rows or tooltip from placement list |

**UI:** **Matrix** tab stays read-only; clicks deep-link to placement/rule editor (future).

---

### 3.4 Arm-specific schedules (eventual)

1. **Authoring:** User selects arm in shell → all tabs filter templates, rules, matrix.  
2. **Generation:** `generateScheduleFromRules(document, { armId })` filters visits/rules/placements.  
3. **Storage:** Single document with arm-scoped fields **or** per-arm schedule cache slices (implementation choice later).  
4. **Export:** One arm per SoA table in protocol PDF narrative (typical sponsor pattern).

**Interim (Phase C):** Filter by `armRestrictions` without duplicating visit definitions.

---

### 3.5 Conditional Protocol Logic attachment

| CPL action (examples) | Target level | Current hook |
|----------------------|--------------|--------------|
| Stop / add assessment | Assessment placement | Rule delete/create (manual) |
| Add/remove activity | Activity | ❌ No activity entity |
| Reorder activities | Activity order | ❌ |
| Add unscheduled visit | Visit | ❌ |
| Transition element | Element | Graph only |
| Transition epoch | Epoch | ❌ |
| Switch arm | Arm | ❌ |

**Recommended model:** `ConditionalProtocolRule { condition, effects: ExecutionEffect[] }` where each effect references `ExecutionTarget` discriminated union (see execution architecture §6).

**Phase D dependency:** Phase B activities + Phase C arm scope + stable visit/assessment catalogs.

---

## 4. UI gap snapshot (post–workflow refinement PR)

| UI area | Current (this PR) | Target |
|---------|-------------------|--------|
| Tab orientation | Horizontal workflow tabs | ✅ Aligned |
| Tab order | Epochs → Arms → Visits → … → Matrix | ✅ Aligned to execution order (partial) |
| Matrix | Dedicated **Matrix** tab, full height | ✅ |
| Assessments | CRUD, no visible ids in table | ✅ |
| Visits | Schedule + Schedule Rules sub-tabs | Schedule ✅; Rules placeholder ✅ |
| Change Control | Shell header button (promoted later) | Interim ✅ |
| Arm selector | Not present | Phase C |
| Activity authoring | Placeholder tab | Phase B |

---

## 5. Recommended phases

### Phase A — Minimal disruption (current track + docs)

**Scope:** UI workflow alignment, documentation, no new domain types.

| Deliverable | Status |
|-------------|--------|
| `PROTOCOL_EXECUTION_MODEL_ARCHITECTURE.md` | ✅ Published |
| `EXECUTION_MODEL_GAP_ANALYSIS.md` | ✅ This document |
| Horizontal tabs, Matrix tab, Assessments CRUD UX | ✅ This PR |
| Arm selector | Deferred |
| Activity model | Deferred |

**Risk:** Low. **Value:** Authoring order matches future hierarchy; Stage 2 parity unchanged.

---

### Phase B — Activity introduction

| Deliverable | Domain | UI |
|-------------|--------|-----|
| `visitActivityDefinitions[]` (name TBD) | New collection under visit schedule | Activities tab editor |
| Optional `activityId` on rules/placements | Extend intersection | Schedule Rules sub-tab |
| Default activity per visit | Generator shim | No author burden for simple studies |
| Rollup to Assessment × Visit cells | Generator | Matrix unchanged visually |

**Dependencies:** Phase A complete.  
**Complexity:** High.  
**Stage 2 tests:** Extend smoke tests; keep visit-only rules passing.

---

### Phase C — Arm-aware schedules

| Deliverable | Domain | UI |
|-------------|--------|-----|
| `activeArmId` authoring context | Store/UI state | Shell arm selector |
| Filter visits/rules/matrix by arm | Generator + selectors | Matrix per arm |
| Arm-specific visit templates (optional) | New or tagged visit defs | Arms + Visits tabs |

**Dependencies:** Phase B recommended (activities often arm-specific).  
**Complexity:** Medium–High.

---

### Phase D — Conditional logic integration

| Deliverable | Domain | UI |
|-------------|--------|-----|
| `conditionalProtocolLogic[]` + `ExecutionTarget` | New module | Conditional Logic tab authoring |
| CPL → placement/activity mutations | Resolver service | Impact preview |
| Narrative governance by hierarchy level | Governance engine | Metadata / Change Control |

**Dependencies:** Phases B–C.  
**Complexity:** Very high.

---

## 6. Phase dependency diagram

```
Phase A (UI + docs)
    │
    ▼
Phase B (Activities + placement rollup)
    │
    ├──► Phase C (Arm-aware views)
    │
    └──► Phase D (CPL + narrative targets)
```

---

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Authors confuse clinical design “assessments” with SoA catalog | UI labels: **Activities** vs **Assessments**; docs |
| Breaking parity on generator change | Default activity rollup; golden fixtures per phase |
| Premature CPL without targets | Phase D gate; placeholder tab until model exists |
| Arm filter incomplete | Start with `armRestrictions` filter before duplicate visit catalogs |

---

## 8. Recommendation

1. **Adopt Phases A–D** as the execution-model delivery sequence without rewriting Stage 2 plans yet.  
2. **Treat `assessmentScheduleRules` as the transitional Assessment × Visit layer** until Phase B placements exist.  
3. **Keep generated schedule as rollup** with arm filter and header tree as incremental generator enhancements.  
4. **Invest next in Phase B** (visit-scoped activities) as the highest structural leverage before CPL.

---

**Document version:** 1.0  
**Last updated:** 2026-06-04
