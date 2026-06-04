# STAGE_2_IMPLEMENTATION_PLAN.md

# Akyrian M11 Studio — Stage 2 Implementation Plan

**Stage:** 2 — Visit Schedule Model & SoA Configuration Architecture  
**Focus:** Operational *when* of study visits, assessment timing rules, and generated Schedule of Activities  
**Status:** Planned  
**Baseline:** Stage 1a complete (`89ee8bf` — clinical design graph editing foundation)  
**Last updated:** 2026-06-02 (Stage 2e workflow reorder)

---

## Authority Documents

Read before implementing any Stage 2 task:

1. [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)  
2. [ARCHITECTURE_VISION.md](./ARCHITECTURE_VISION.md)  
3. [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)  
4. [STAGE_0_CLOSURE_REPORT.md](./STAGE_0_CLOSURE_REPORT.md)  
5. [STAGE_1_IMPLEMENTATION_PLAN.md](./STAGE_1_IMPLEMENTATION_PLAN.md)  
6. [ARCHITECTURE.md](./ARCHITECTURE.md) — linkage model  
7. This document

---

## Roadmap Alignment Note

[PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md) labels **Stage 2** as *Standards Intelligence* and **Stage 3** as *Schedule of Activities Configuration*. This plan defines M11 Studio’s **Stage 2 engineering track** for visit scheduling and SoA generation—the operational scheduling layer that the brief and architecture vision require but ICH M11 does not fully specify.

| Roadmap stage | Relationship to this plan |
|---------------|---------------------------|
| Stage 1 (complete) | Clinical design entities + relationships editable; `schedule` still a flat matrix in seed |
| **This plan (Stage 2 track)** | Clinical Design linkage, Visit Schedule Model, AssessmentScheduleRules, generated SoA, SoA metadata ownership (`soaAssessmentDefinitions`, visit display metadata) |
| Roadmap Stage 2 (Standards Repository) | Parallel / later; terminology hooks referenced but not implemented here |
| Roadmap Stage 3 (SoA Configuration UI) | **Stage 2e** in this plan delivers minimal UI on top of domain model; **Conditional Protocol Logic** tab is a **future** SoA Configuration extension (post–Stage 2 generator) |
| Roadmap Stage 4 (Validation Platform) | **Stage 2f** scaffolds narrative ↔ schedule consistency checks; **Narrative Update Governance** extends this into amendment, Copilot, and approval workflows |
| Roadmap Stage 5 (Copilot) | Consumes structured SoA + conditional logic as inputs for proposed narrative updates under governance |
| Roadmap Stage 6+ (Amendments / SDTM) | Structured schedule and conditional pathways drive amendment impact analysis and downstream mapping |

**Scope boundary for Stage 2:** Stage 2 focuses on **Clinical Design**, **Visit Schedule**, **AssessmentScheduleRules**, **generated SoA**, and **SoA metadata ownership**. It does **not** implement Conditional Protocol Logic or full Narrative Update Governance. Those are architectural extensions documented here for downstream stages.

**Authority direction:** Generated SoA and (future) Conditional Protocol Logic become **structured sources** that drive protocol narrative updates—not manually edited Word-style tables or prose that drift from configuration.

---

## 1. Core Premise

The **ICH M11 Technical Specification** defines clinical design structure and many protocol content elements (objectives, endpoints, assessments, study arms, etc.), but it does **not** fully define the operational **when** of visits—nominal days, windows, anchoring to randomization or first dose, rolling vs fixed schedules, or assessment-specific timing exceptions.

In **EDC / SDE configuration**, a study schedule is typically organized around an **anchor visit** or **anchor event** that defines the nominal timeline for downstream visits. When visits are missed or delayed, protocol-defined behavior determines whether the schedule **preserves the original anchor timeline** or **re-anchors** downstream visits to actual visit dates. M11 Studio must model both the anchor definition and re-anchoring policies as structured data—not prose in a table footnote.

M11 Studio therefore introduces a **first-class Visit Schedule Model** that:

- Complements `clinicalDesign` (the *what* of the trial design)  
- Feeds **AssessmentScheduleRules** (assessment × visit intersections and timing)  
- **Generates** the SoA matrix (`schedule`) as a **view**, not the source of truth  

**Guiding principle (from PROJECT_BRIEF):** *Structured before narrative.* The visit schedule and SoA rules are structured objects; the SoA grid and narrative sections are renderings.

**Guiding question:**

> Does this make visit timing computable, validatable, and traceable to clinical design—without forking truth between the SoA table and the dependency graph?

---

## 2. Current State (Post–Stage 1a)

| Capability | State |
|------------|--------|
| `clinicalDesign.visits` | ✅ `DesignEntity` rows for graph (`visit-1`, `visit-2`, …) |
| `relationships` (`performed-at`) | ✅ Assessment → visit links in dependency graph |
| `schedule.visits` | ✅ Flat column defs: `id`, `label`, `order`, optional `entityId`, optional `timepoint` string |
| `schedule.assessments` | ✅ Flat row defs: `id`, `label`, `category`, optional `entityId`, `linkedSectionId` |
| `schedule.cells` | ✅ Sparse `{ visitId, assessmentId, required, notes? }` matrix |
| Visit windows (structured) | ❌ Only free-text `timepoint` (e.g. `"Day -28 to -1"`) |
| Schedule anchoring | ❌ Not modeled |
| Schedule anchors / re-anchoring | ❌ Not modeled |
| Missed-visit / ripple policies | ❌ Not modeled |
| Assessment-level timing rules | ❌ Not modeled |
| SoA as generated artifact | ❌ `schedule` is authored directly in seed JSON |
| SoA configuration UI | ❌ Read-only grid via `ScheduleOfActivities` |
| Narrative ↔ schedule validation | ❌ Deferred to Stage 4 in roadmap; scaffolding only in 2f |

**Existing linkage (Stage 0):**

```
clinicalDesign.assessments ──performed-at──► clinicalDesign.visits
schedule.assessments ──entityId?──► clinicalDesign.assessments
schedule.visits ──entityId?──► clinicalDesign.visits
schedule.cells ──visitId + assessmentId──► schedule rows/columns
```

Partial `entityId` coverage is documented technical debt ([STAGE_0_CLOSURE_REPORT.md](./STAGE_0_CLOSURE_REPORT.md)).

---

## 3. Target Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ProtocolDocument (store)                     │
├─────────────────────────────────────────────────────────────────┤
│  clinicalDesign          │  WHAT: objectives, endpoints,        │
│  (Stage 1 — source)      │  assessments, visits, arms, …        │
├──────────────────────────┼──────────────────────────────────────┤
│  visitSchedule           │  WHEN: visit timing, windows,        │
│  (Stage 2 — source)      │  anchors, re-anchoring, policies     │
│                          │  (`anchors[]` + `visitDefinitions[]`)│
├──────────────────────────┼──────────────────────────────────────┤
│  soaAssessmentDefinitions│  SoA ROWS: label, category, order,   │
│  (Stage 2d — source)     │  linkedSectionId, CD assessment link │
├──────────────────────────┼──────────────────────────────────────┤
│  assessmentScheduleRules │  HOW: assessment occurs at visit,      │
│  (Stage 2 — source)      │  requiredness, per-assessment windows│
├──────────────────────────┼──────────────────────────────────────┤
│  conditionalProtocolLogic│  FUTURE: branching / decision rules  │
│  (post–Stage 2)          │  (arm, dose, visit, assessment,     │
│                          │   protocol-status impacts)           │
├──────────────────────────┼──────────────────────────────────────┤
│  schedule                │  VIEW: generated SoA matrix          │
│  (Stage 2 — derived)       │  (visits, assessments, cells)      │
├──────────────────────────┼──────────────────────────────────────┤
│  elements / sections     │  NARRATIVE: prose fields; governed   │
│  (existing)              │  updates driven by structured config │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   Dependency Graph              SoA Grid UI
   (clinicalDesign +             (selectors from
    relationships)                generated schedule)
```

**Rules:**

1. **Do not edit `schedule.cells` directly** once generation exists—mutations target `visitSchedule` and `assessmentScheduleRules`.  
2. **`schedule` may remain in JSON export** for portability, but must be reproducible from sources via `generateSchedule()`.  
3. **Graph visit nodes** remain `clinicalDesign.visits`; visit schedule entries reference them via `clinicalDesignVisitId` (or shared `id` where 1:1).  
4. **Regeneration** runs after schedule/rule mutations; `metadata.updatedAt` and `subscribe()` notify views (same pattern as Stage 1).

---

## 4. Visit Schedule Model

### 4.1 Purpose

Introduce **first-class Visit Schedule entities** that describe *when* a protocol visit occurs in study time—not merely its label in a table column.

Examples in seed protocol context:

| Visit | Role |
|-------|------|
| Screening | Pre-randomization eligibility |
| Baseline | Day 1 / randomization visit |
| Cycle 1 Day 1 | First treatment cycle start |
| Cycle 1 Day 15 | Mid-cycle safety / compliance |
| Cycle 2 Day 1 | Subsequent cycle |
| End of Treatment | Treatment discontinuation |
| Safety Follow-up | Post-treatment safety window |
| Long-term Follow-up | Extended survival / PRO follow-up |

### 4.2 Relationship to `clinicalDesign.visits`

| Layer | Responsibility |
|-------|----------------|
| `clinicalDesign.visits[]` | Semantic visit for graph, narrative anchors, `sectionRef`, status |
| `visitSchedule.visits[]` | Operational schedule entry: timing, windows, policies |

Each schedule entry **should** link to a clinical design visit:

```typescript
clinicalDesignVisitId: string  // required when visit exists in design model
```

When a SoA column represents a visit not yet in clinical design (rare during authoring), allow orphan schedule rows with validation warnings until linked.

### 4.3 Recommended `VisitScheduleEntry` schema

Proposed location: `ProtocolDocument.visitSchedule.visits[]`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Stable schedule row id (e.g. `vs-screening`, `vs-c1d1`) |
| `clinicalDesignVisitId` | `string?` | Link to `clinicalDesign.visits[].id` |
| `name` | `string` | Display name (may mirror clinical design `name`) |
| `visitType` | controlled term | e.g. `screening`, `baseline`, `treatment`, `follow-up`, `early-termination`, `unscheduled` |
| `epoch` | `string?` | Study epoch (screening, treatment, follow-up)—links to future epoch model |
| `cycleNumber` | `number?` | Cycle index when applicable (1, 2, 3, …) |
| `anchorId` | `string` | **Required.** Reference to `visitSchedule.anchors[].id` (see §5) |
| `offsetDays` | `number?` | Nominal offset in days from anchor |
| `offsetWeeks` | `number?` | Nominal offset in weeks from anchor (imaging q8w) |
| `offsetCycles` | `number?` | Nominal offset in cycles from cycle-based anchor |
| `nominalDay` | `number?` | Resolved or author-specified nominal study day (display / validation) |
| `nominalWeek` | `number?` | Resolved or author-specified nominal week |
| `windowBeforeDays` | `number?` | Days before nominal (symmetric or asymmetric “before”) |
| `windowAfterDays` | `number?` | Days after nominal |
| `armRestrictions` | `string[]?` | Study arm ids when visit applies to subset of arms |
| `required` | `boolean` | Whether visit is mandatory in protocol schedule |
| `description` | `string?` | Author notes / operational guidance |
| `order` | `number` | Column ordering in generated SoA |
| `missedVisitPolicy` | `MissedVisitPolicy` | See §5.3 |
| `reanchorPolicy` | `ReanchorPolicy` | See §5.3 |
| `ripplePolicy` | `RipplePolicy` | See §5.3 |
| `allowedMakeupWindowDays` | `number?` | Max days for makeup visit when policy allows |

Proposed container shape:

```typescript
interface VisitScheduleModel {
  defaults?: VisitScheduleDefaults;
  anchors: ScheduleAnchor[];       // first-class anchor catalog
  visits: VisitScheduleEntry[];
}
```

**Note:** `windowBeforeDays` / `windowAfterDays` on the visit define the **default visit window**. Assessment-specific overrides live in `AssessmentScheduleRule` (§7). Legacy inline `anchorEvent` refs (if present during migration) normalize to `ScheduleAnchor` + `anchorId`.

---

## 5. Anchor Visit and Re-Anchoring Model

### 5.1 Core premise

In EDC / SDE configuration, a study schedule often has an **anchor visit** or **anchor event** that defines the nominal timeline for downstream visits. When visits are **missed** or **delayed**, the protocol defines whether to:

- **Preserve the original anchor schedule** (fixed timeline—late visits are deviations but do not move future nominal dates), or  
- **Re-anchor downstream visits** to a new actual visit date (rolling timeline—subsequent visits shift with dose delays or visit slips).

M11 Studio models anchors, per-visit offsets, windows, and re-anchoring policies as **first-class structured data** in `visitSchedule`—not implicit in SoA column headers or narrative prose.

---

### 5.2 Anchor visit / anchor event

A protocol schedule may be anchored to one or more study milestones. The **`ScheduleAnchor`** catalog declares reusable anchor definitions; each **`VisitScheduleEntry`** references an anchor by `anchorId`.

**Supported anchor types (`anchorType`):**

| `anchorType` | Typical role |
|--------------|--------------|
| `informed-consent` | Screening / eligibility window start |
| `screening` | Screening visit completion |
| `randomization` | Baseline / Day 1 reference |
| `first-dose` | Treatment start; cycle day math |
| `cycle-1-day-1` | Explicit C1D1 anchor (may alias first-dose) |
| `previous-visit` | Rolling schedules (next visit relative to prior) |
| `last-dose` | Safety follow-up anchor |
| `end-of-treatment` | EOT visit cluster |
| `disease-progression` | Unscheduled / crossover triggers |
| `investigator-decision` | Discretionary scheduling per protocol |
| `custom` | Protocol-specific event with `description` |

**Recommended `ScheduleAnchor` schema**

Proposed location: `ProtocolDocument.visitSchedule.anchors[]`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Stable anchor id (e.g. `anchor-randomization`, `anchor-first-dose`) |
| `name` | `string` | Display name |
| `anchorType` | `ScheduleAnchorType` | One of the types above |
| `sourceVisitId` | `string?` | `visitSchedule.visits[].id` when anchor is tied to a defined visit (e.g. Screening, C1D1) |
| `sourceEventType` | `string?` | Execution-layer event code (future SDE hook); optional in authoring MVP |
| `description` | `string?` | Protocol language / operational notes |

```typescript
interface ScheduleAnchor {
  id: string;
  name: string;
  anchorType: ScheduleAnchorType;
  sourceVisitId?: string;
  sourceEventType?: string;
  description?: string;
}
```

**Relationship to clinical design:** When `sourceVisitId` maps to a visit with `clinicalDesignVisitId`, graph nodes and schedule anchors stay traceable to the same semantic visit entity.

---

### 5.3 Visit anchoring

Each visit declares **how** it is positioned relative to an anchor—not just a free-text `timepoint` string.

**Required / recommended fields on `VisitScheduleEntry` (anchoring subset):**

| Field | Purpose |
|-------|---------|
| `anchorId` | Points to `visitSchedule.anchors[].id` |
| `offsetDays` | Nominal offset in days from anchor (e.g. C1D15 → +14 days from C1D1 anchor) |
| `offsetWeeks` | Nominal offset in weeks (e.g. imaging q8w → +8, +16, …) |
| `offsetCycles` | Offset in treatment cycles when anchor is cycle-based |
| `nominalDay` | Authoritative or computed nominal day for validation display |
| `nominalWeek` | Authoritative or computed nominal week |
| `windowBeforeDays` | Allowable days before nominal |
| `windowAfterDays` | Allowable days after nominal |

**Resolution order (for generation / validation):**

1. Resolve anchor from `anchorId` → `ScheduleAnchor`  
2. Apply `offsetDays` / `offsetWeeks` / `offsetCycles`  
3. Apply visit-level window  
4. Apply assessment-rule overrides where present  

---

### 5.4 Missed visit / delayed visit policy

When a visit occurs outside its window, is missed, or is delayed, three policy dimensions govern behavior:

#### `missedVisitPolicy`

| Value | Meaning |
|-------|---------|
| `skip` | Missed visit is not made up; assessments at that timepoint are skipped |
| `makeUpAsSoonAsPossible` | Visit should occur ASAP within `allowedMakeupWindowDays` |
| `recordDeviationOnly` | Out-of-window or missed visit recorded as deviation; schedule logic unchanged |
| `investigatorDecision` | Per-investigator / per-protocol discretion; document in `description` |

#### `reanchorPolicy`

| Value | Meaning |
|-------|---------|
| `preserveOriginalAnchor` | Downstream nominal dates remain tied to original anchor (fixed schedule) |
| `reanchorToActualVisitDate` | Downstream visits re-anchor to actual date of this visit (rolling schedule) |
| `reanchorOnlyWithinWindow` | Re-anchor only if actual date falls within window |
| `reanchorOnlyIfProtocolSpecified` | Re-anchor only when protocol explicitly allows (narrative cross-check in 2f) |
| `hybrid` | Mix of fixed and rolling by visit type, epoch, or assessment rule flags |

#### `ripplePolicy`

| Value | Meaning |
|-------|---------|
| `noRipple` | No downstream shift |
| `rippleSubsequentVisits` | All later visits in schedule shift with delay |
| `rippleWithinEpochOnly` | Ripple confined to current epoch (e.g. treatment, not follow-up) |
| `rippleWithinCycleOnly` | Ripple confined to current cycle |
| `rippleSelectedVisitTypesOnly` | Only visits matching configured types shift (e.g. treatment days, not imaging) |

**Global defaults** (`VisitScheduleDefaults`) supply baseline policies; per-visit fields override when set.

```typescript
interface VisitScheduleDefaults {
  missedVisitPolicy: MissedVisitPolicy;
  reanchorPolicy: ReanchorPolicy;
  ripplePolicy: RipplePolicy;
  allowedMakeupWindowDays?: number;
}
```

---

### 5.5 Examples

#### Example A — Fixed schedule

| Element | Value |
|---------|-------|
| Anchor | Cycle 1 Day 1 (`anchor-first-dose` / `cycle-1-day-1`) |
| Visit | Cycle 1 Day 15 — nominal Day 15, window ±3 days |
| Scenario | Patient attends C1D15 on **Day 20** (outside window) |
| Outcome | Visit recorded as **protocol deviation** (`recordDeviationOnly` or window violation) |
| Downstream | **Cycle 2 Day 1** remains anchored to **original C1D1** (`preserveOriginalAnchor`, `noRipple`) |

#### Example B — Rolling schedule

| Element | Value |
|---------|-------|
| Anchor | Previous treatment visit (`previous-visit`) |
| Scenario | Patient attends treatment visit **5 days late** |
| Policies | `reanchorToActualVisitDate`, `rippleSubsequentVisits` |
| Outcome | **Next visit** nominal date shifts **+5 days** relative to actual prior visit |

#### Example C — Hybrid oncology schedule

| Element | Behavior |
|---------|----------|
| Treatment visits | May shift with dose delays — `reanchorToActualVisitDate`, `rippleWithinCycleOnly` |
| Tumor imaging | Every **8 weeks from first dose**, `independentOfDoseDelay: true` on assessment rules — **fixed** imaging calendar |
| Safety follow-up | Anchored to **actual last dose** (`last-dose` anchor), +30 days ±7 — not shifted by treatment ripple |

This example requires **conflicting policies by visit type and assessment rule**—validated in Stage 2f when imaging visits use `preserveOriginalAnchor` while adjacent treatment visits use rolling re-anchor.

---

### 5.6 SoA generation implication

The SoA matrix is **generated** from authoritative sources—not edited as the primary store:

```
generateSchedule(document):
  Inputs:
    clinicalDesign          (assessment + visit entities)
    visitSchedule.anchors   (ScheduleAnchor catalog)
    visitSchedule.visits    (VisitScheduleEntry + anchorId + offsets + policies)
    assessmentScheduleRules (intersections + assessment timing)

  Outputs:
    schedule.visits         (columns: order, label, rendered timepoint)
    schedule.assessments    (rows: from clinical design)
    schedule.cells          (from rules)
```

**Generation responsibilities:**

| Output | Derived from |
|--------|--------------|
| Column order | `VisitScheduleEntry.order` |
| Column label | `VisitScheduleEntry.name` |
| `timepoint` string | Anchor name + offsets + windows (replaces free-text-only) |
| Cell presence | `AssessmentScheduleRule` |
| Policy metadata (future) | Embedded in cell/visit notes or extension fields for SDE export |

Re-anchoring policies affect **execution simulation** (post–Stage 2); authoring MVP **stores** policies and validates consistency. Nominal SoA columns reflect **protocol-intended** schedule; actual shifted dates are an operational overlay.

---

### 5.7 Validation implications

Future validators (`validateVisitSchedule`, `validateScheduleConsistency`) should include:

| Code (proposed) | Check |
|-----------------|-------|
| `VISIT_MISSING_ANCHOR` | Visit has no `anchorId` or anchor not found in catalog |
| `VISIT_MISSING_WINDOW` | Required visit has no window when protocol implies one |
| `REANCHOR_POLICY_CONFLICT` | `reanchorPolicy` on visit conflicts with `AssessmentScheduleRule.independentOfDoseDelay` |
| `IMAGING_ROLLING_CONFLICT` | Imaging assessment marked independent of dose delay but visit uses rolling re-anchor |
| `VISIT_OUTSIDE_WINDOW` | Execution/simulation: actual date outside window (warning/error) |
| `MISSED_VISIT_POLICY_UNDEFINED` | Required visit lacks `missedVisitPolicy` (inherit default or error) |
| `RIPPLE_UNDEFINED_FOR_ROLLING` | Visit uses rolling re-anchor but `ripplePolicy` is `noRipple` |
| `ANCHOR_ORPHAN_VISIT` | `ScheduleAnchor.sourceVisitId` points to missing visit |
| `NARRATIVE_REANCHOR_MISMATCH` | Narrative describes fixed schedule; model uses rolling re-anchor (Stage 2f) |

---

### 5.8 UI implications (Stage 2e+)

Future **SoA Configuration UI** controls (not implemented in domain-only phases):

| Control | Binds to |
|---------|----------|
| Select anchor visit / event | `anchorId` → `ScheduleAnchor` picker (catalog + create) |
| Define nominal offset | `offsetDays`, `offsetWeeks`, `offsetCycles` |
| Define allowable window | `windowBeforeDays`, `windowAfterDays` |
| Choose missed-visit policy | `missedVisitPolicy` |
| Choose re-anchor behavior | `reanchorPolicy` |
| Choose ripple behavior | `ripplePolicy` |
| Preview generated schedule | Read-only `generateSchedule()` preview before save |
| Hybrid preview (Example C) | Side-by-side nominal vs rolling simulation (later) |

UI writes **`visitSchedule`** and **`assessmentScheduleRules`** only; grid cells remain generated.

---

## 6. Visit Window Model

Visit windows express **allowable timing variance** around a nominal point anchored per §5.

### 6.1 Window types

| Pattern | Representation |
|---------|----------------|
| Symmetric window | `windowBeforeDays: 7`, `windowAfterDays: 7` → ±7 days |
| Asymmetric window | `windowBeforeDays: 3`, `windowAfterDays: 7` → −3/+7 days |
| Fixed visit (no window) | both `0` or explicit fixed flag |
| Window relative to anchor | `anchorId` + offsets + window fields |
| Assessment-specific window | `AssessmentScheduleRule.windowBeforeDays` / `windowAfterDays` override visit defaults |

### 6.2 Examples

| Visit | Nominal | Window | Anchor (`anchorType`) |
|-------|---------|--------|------------------------|
| Screening | Day −14 (midpoint) | −28 / +0 days before randomization | `randomization` |
| C1D1 | Day 1 | ±0 days | `randomization` or `first-dose` |
| C1D15 | Day 15 | ±3 days | `first-dose` or `cycle-1-day-1` |
| Tumor imaging | Every 8 weeks | ±7 days | `first-dose` (fixed via assessment rule) |
| Safety follow-up | +30 days | ±7 days | `last-dose` |

### 6.3 `VisitWindow` helper type (optional normalized form)

For validation and narrative generation, normalize to:

```typescript
interface VisitWindow {
  anchorId: string;
  nominalDay?: number;
  nominalWeek?: number;
  offsetDays?: number;
  offsetWeeks?: number;
  offsetCycles?: number;
  beforeDays: number;
  afterDays: number;
  windowType: 'symmetric' | 'asymmetric' | 'fixed' | 'interval';
}
```

---

## 7. Assessment-Level Timing

Not all timing is visit-level. Some assessments have independent windows or continuous collection.

### 7.1 Examples

| Assessment | Timing rule |
|--------------|-------------|
| Labs | May be collected up to 3 days **before** C1D1 |
| PRO questionnaire | Must occur **before** drug administration at visit |
| Tumor imaging | Every 8 weeks **independent of dose delays** |
| AE monitoring | Begins at consent; **continuous** through follow-up |

### 7.2 `AssessmentScheduleRule` schema

Proposed location: `ProtocolDocument.assessmentScheduleRules[]`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Stable rule id |
| `assessmentId` | `string` | **Required.** Canonical: `soaAssessmentDefinitions[].id`. Clinical design linkage via catalog `clinicalDesignAssessmentId`. |
| `visitDefinitionId` | `string` | **Required.** `visitSchedule.visitDefinitions[].id` |
| `required` | `boolean` | SoA cell required vs optional |
| `timingNote` | `string?` | Human-readable timing (also for narrative generation) |
| `windowBeforeDays` | `number?` | Override visit window (before) |
| `windowAfterDays` | `number?` | Override visit window (after) |
| `relativeTiming` | `RelativeTiming?` | e.g. `before-administration`, `after-administration`, `continuous`, `between-visits` |
| `condition` | `ScheduleCondition?` | Arm, population, or expression (future) |
| `armRestrictions` | `string[]?` | Limit rule to arms |
| `repeats` | `boolean?` | Repeat at every matching visit vs once |
| `independentOfDoseDelay` | `boolean?` | Imaging / survival follow-up unaffected by rolling schedule |
| `notes` | `string?` | Cell notes in generated SoA |
| `linkedSectionId` | `string?` | Narrative section for consistency checks |

```typescript
type RelativeTiming =
  | 'at-visit'
  | 'before-administration'
  | 'after-administration'
  | 'continuous'
  | 'between-visits'
  | 'interval-weeks';

interface ScheduleCondition {
  expression?: string;       // future: structured condition language
  armIds?: string[];
  populationIds?: string[];
}
```

### 7.2.1 Assessment reference strategy (Stage 2d Phase 2 — normalized)

**Canonical rule:** `AssessmentScheduleRule.assessmentId` references **`soaAssessmentDefinitions[].id`** because the SoA assessment catalog owns row identity and presentation metadata for schedule intersections. Clinical design linkage is resolved through **`SoAAssessmentDefinition.clinicalDesignAssessmentId`**, not by storing `assess-*` ids directly on rules.

**Layer model (PROTO-XYZ-301):**

| Layer | Role | Id examples |
|-------|------|-------------|
| `clinicalDesign.assessments[]` | Graph / WHAT entities | `assess-1`, `assess-2`, `assess-3` |
| `soaAssessmentDefinitions[]` | **Canonical rule target** — SoA row catalog | `a1`–`a12` with optional `clinicalDesignAssessmentId` |
| `schedule.assessments[]` | Legacy cached/generated SoA view | Mirrors catalog output until authoritative swap |
| `assessmentScheduleRules[]` | Authoritative intersections | `assessmentId: "a1"` … `"a12"` |

**Rule metadata (post-normalization):**

```typescript
metadata: {
  assessmentRefKind: 'soaAssessment';
  soaAssessmentDefinitionId: string;   // mirrors assessmentId
  legacyScheduleAssessmentId?: string;  // migration trace to hand-authored schedule rows
  clinicalDesignAssessmentId?: string;  // denormalized from catalog when linked
  scheduleVisitId?: string;             // migration trace to legacy schedule.cells
}
```

Deprecated transitional fields (`assessmentRefKind: 'schedule'`, `metadata.scheduleAssessmentId`) emit validation warnings if still present.

**Validation policy:**

| Code | Severity | When |
|------|----------|------|
| `invalid_assessment_schedule_rule_assessment` | error | `assessmentId` not in `soaAssessmentDefinitions[]` |
| `assessment_schedule_rule_clinical_design_assessment_ref` | error | Rule uses `clinicalDesign.assessments[].id` directly |
| `assessment_schedule_rule_metadata_clinical_mismatch` | warning | Rule metadata CD id ≠ catalog `clinicalDesignAssessmentId` |
| `assessment_schedule_rule_deprecated_schedule_metadata` | warning | Legacy `metadata.scheduleAssessmentId` still present |
| `assessment_schedule_rule_deprecated_ref_kind` | warning | `metadata.assessmentRefKind === 'schedule'` |

**Removed warnings (migration complete for seed):** `assessment_schedule_rule_schedule_assessment_ref`, `assessment_schedule_rule_prefer_clinical_design_assessment`, `assessment_schedule_rule_missing_ref_metadata`.

**Stage 2d generation mapping:**

1. Resolve rule `assessmentId` → `soaAssessmentDefinitions[]` row.
2. Project `clinicalDesignAssessmentId` to generated `ScheduleAssessment.entityId` when present.
3. Emit `schedule.cells[]` using generated visit column ids + catalog assessment ids.

**Stage 2d Phase 2 PR 1 (implemented):** All 44 seed rules normalized to canonical `soaAssessmentDefinitions` ids with `assessmentRefKind: 'soaAssessment'`. Rules no longer resolve through `schedule.assessments`.

**Stage 2d Phase 2 PR 2 (implemented):** Explicit schedule cache regeneration via `regenerateScheduleCache()` with `sourceHash` staleness tracking. Validation warnings: `schedule_cache_missing_metadata`, `schedule_cache_stale`, `schedule_cache_not_generated_from_rules`. Seed remains legacy hand-authored until authoritative swap; no auto-regen on mutation.

**Stage 2d Phase 2 PR 3 (implemented):** Generated schedule parity baseline for PROTO-XYZ-301. Golden fixtures under `parity/fixtures/generatedSchedule/` (`visits`, `assessments`, `cells`, `metadata`, `acceptedContentDiffs`). `npm run test:schedule-parity` verifies generator stability and legacy replacement candidacy. Two tumor-imaging `timingNote` → cell `notes` diffs at `v6/a8` and `v8/a8` are accepted content differences only.

**Stage 2d Phase 2 PR 4 (implemented):** Automatic schedule cache regeneration after successful mutations to `visitSchedule`, `assessmentScheduleRules`, and schedule anchors via `regenerateScheduleCacheAfterMutation()` inside the same store mutation callback (single subscriber notify). Failed mutations do not regenerate. Explicit `regenerateScheduleCache()` remains available.

**Stage 2d Phase 2 PR 5 (implemented):** Authoritative generated schedule flip. Seed `document.schedule` aligned to `generateScheduleFromRules()` output with cache metadata and canonical tumor-imaging cell notes. Default selectors read generated cache; `{ generated: true }` is live debug preview only. Legacy/Generated UI toggle removed. Export calls `ensureAuthoritativeScheduleCacheFresh()` before serialization. Parity fixtures updated; accepted legacy diffs are zero.

### 7.3 Relationship to dependency graph

When `assessmentScheduleRule` is created for `(assessmentId, visitScheduleId)`:

- **`generateSchedule()`** emits a `schedule.cells[]` entry.  
- Optionally sync **`relationships`** with `kind: 'performed-at'` if not already present (Stage 2c policy: prefer single source—rules generate both cells and relationships, or validate alignment).

Recommended: **AssessmentScheduleRules are authoritative for SoA cells**; `performed-at` relationships are **validated for consistency**, not independently authored for the same pair.

---

## 8. SoA Configuration Layer

### 8.0 Matrix foundation (product logic)

The generated SoA matrix is **Assessment × Visit**:

| Layer | Source | Role |
|-------|--------|------|
| **Y axis (rows)** | `soaAssessmentDefinitions[]` | Assessment/procedure rows in the grid |
| **X axis (columns)** | `visitSchedule.visitDefinitions[]` (+ `anchors[]`) | Visit columns with timing and display metadata |
| **Cells (intersections)** | `assessmentScheduleRules[]` | Whether/how an assessment occurs at a visit |
| **Grouping** | Epochs, activities, elements (`clinicalDesign` + relationships) | Organize visits and link narrative after the matrix foundation exists |
| **Branching scope** | `clinicalDesign.studyArms[]` | Arm restrictions on rules; prerequisite for conditional logic (arms are not a matrix axis) |
| **Pathway logic** | future `conditionalProtocolLogic[]` | e.g. switch arms on treatment failure—depends on assessments, visits, arms, and rules |

**Authoring sequence:** SoA Assessment Definitions → Study Visit Definitions → Assessment Schedule Rules → Epochs/Activities/Elements → Study Arms → Conditional Protocol Logic.

Rules are only meaningful once both assessment rows and visit columns exist. Conditional logic such as *“if treatment fails, switch to Study Arm 2”* cannot be meaningfully authored until arms are defined.

### 8.1 What the configuration layer is

The **SoA Configuration Layer** is the combined editable model:

| Component | Role in configuration |
|-----------|-------------------------|
| **Schedule anchors** | `visitSchedule.anchors` — anchor visit / event catalog |
| **SoA assessment rows** | `soaAssessmentDefinitions[]` — row identity and presentation metadata (label, category, order, linkedSectionId, optional `clinicalDesignAssessmentId`) |
| Visit columns | Derived from `visitSchedule.visitDefinitions` (`displayLabel`, `timepointDisplay`, `soaColumnId`) |
| Assessment × Visit intersections | **`assessmentScheduleRules`** |
| Visit anchoring | `anchorId`, offsets, nominal day/week |
| Visit windows | `windowBeforeDays`, `windowAfterDays` |
| Assessment-specific windows | Rule-level overrides |
| Missed / delayed visit policies | `missedVisitPolicy`, `reanchorPolicy`, `ripplePolicy` |
| Conditional rules (rule-level) | `condition`, `armRestrictions` on rules and visits |
| **Conditional Protocol Logic** | **Future extension** — see §8.4; not part of initial Stage 2 generator |

**Stage 2 generator scope:** The initial `generateScheduleFromRules()` pipeline covers visit columns, assessment rows, and rule-derived cells only. It does **not** evaluate conditional branching, arm transitions, dose changes, or protocol-status impacts. Those require the future Conditional Protocol Logic model and downstream execution/validation layers.

### 8.2 What the SoA matrix is NOT

The interactive grid (`ScheduleOfActivities` component) is a **renderer** of generated `schedule`:

- **Not** the authoritative store for “assessment X at visit Y”  
- **Not** the place to define windows or anchors (after Stage 2d)  
- **May** allow cell-level edits in Stage 2e only as shortcuts that **write back** to `assessmentScheduleRules`  

### 8.3 Generated `schedule` shape (compatibility)

Preserve existing selector DTOs for minimal UI churn:

```typescript
// Generated — do not hand-edit after Stage 2d
interface ScheduleDefinition {
  visits: ScheduleVisit[];       // from visitSchedule + labels/order
  assessments: ScheduleAssessment[];  // from clinicalDesign.assessments
  cells: ScheduleCell[];           // from assessmentScheduleRules
  generatedAt?: string;            // metadata
  sourceHash?: string;             // hash of inputs for staleness detection
}
```

Mapping:

| Generated field | Source |
|-----------------|--------|
| `ScheduleVisit.id` | `visitSchedule.visitDefinitions[].soaColumnId` (legacy `v*` during migration) |
| `ScheduleVisit.entityId` | `clinicalDesignVisitId` |
| `ScheduleVisit.label` | `visitSchedule.visitDefinitions[].displayLabel ?? name` |
| `ScheduleVisit.order` | `visitSchedule.visitDefinitions[].order` |
| `ScheduleVisit.timepoint` | `visitSchedule.visitDefinitions[].timepointDisplay ??` rendered anchor timing |
| `ScheduleAssessment.id` | `soaAssessmentDefinitions[].id` (legacy `a*` ids during migration) |
| `ScheduleAssessment.label` | `soaAssessmentDefinitions[].label` |
| `ScheduleAssessment.category` | `soaAssessmentDefinitions[].category` |
| `ScheduleAssessment.linkedSectionId` | `soaAssessmentDefinitions[].linkedSectionId` |
| `ScheduleAssessment.entityId` | `soaAssessmentDefinitions[].clinicalDesignAssessmentId` |
| `ScheduleCell.required` | `AssessmentScheduleRule.required` |
| `ScheduleCell.notes` | `AssessmentScheduleRule.timingNote` |

**Stage 2d Phase 1 PR 1 (implemented):** `SoAAssessmentDefinition` catalog added to `ProtocolDocument` with seed backfill from legacy `schedule.assessments`. Selectors and validation are wired.

**Stage 2d Phase 1 PR 2 (implemented):** `VisitDefinition` extended with `displayLabel`, `timepointDisplay`, and `soaColumnId`; seed backfilled from legacy `schedule.visits`. Lookup helpers and validation are wired.

**Stage 2d Phase 1 PR 3 (implemented):** `generateScheduleFromRules()` reads `visitSchedule.visitDefinitions`, `soaAssessmentDefinitions`, and `assessmentScheduleRules` only (plus `clinicalDesign` for entity projection). Legacy `schedule.visits` / `schedule.assessments` are not read during generation; `verifyGeneratedScheduleIndependentOfLegacyScheduleMetadata()` guards this invariant.

**Stage 2d Phase 2 PR 1 (implemented):** All 44 `assessmentScheduleRules` reference canonical `soaAssessmentDefinitions[].id` values (`a1`–`a12`). Validation rejects direct `clinicalDesign.assessments[].id` on rules; clinical design linkage flows through the catalog. Transitional schedule-ref warnings removed from seed validation.

### 8.4 Conditional Protocol Logic (Future Extension)

Not all protocol behavior can be represented by `VisitDefinition`, visit windows, anchors, `AssessmentScheduleRule`, or the generated SoA matrix alone.

Many protocols contain **conditional branching logic** that changes treatment, assessments, visit schedules, study arms, dosing, follow-up procedures, or protocol status based on observed clinical outcomes. Examples:

| Scenario | Structured impact |
|----------|-------------------|
| After 3 weekly chemotherapy cycles, if tumor size increases, switch to Study Arm 2 (Surgery) | Arm transition + downstream visit/assessment changes |
| If progression criteria are met, increase chemotherapy frequency from every 7 days to every 3 days | Dosing / visit cadence change |
| If response is inadequate, add radiation therapy | New intervention + assessments |
| If toxicity exceeds predefined thresholds, reduce dose or delay treatment | Dose modification + rolling schedule impact |
| If progression occurs, declare treatment failure and discontinue treatment | Protocol status + EOT / follow-up pathway |
| If a visit is missed, determine whether downstream visits remain anchored to the original anchor visit or become re-anchored to the actual visit date | Re-anchor / ripple policy activation (may overlap visit-level policies but often requires outcome-triggered logic) |

**Proposed model:** Introduce a future collection such as **`ProtocolDecisionRule`** or **`ConditionalPathwayRule`** on `ProtocolDocument` (exact name TBD).

**Illustrative schema (future):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Stable rule id |
| `name` | `string` | Author-facing label |
| `description` | `string?` | Operational / clinical intent |
| `triggerEvent` | controlled term / ref | What initiates evaluation (visit completion, assessment result, timepoint, investigator action) |
| `evaluatedAfterVisitDefinitionId` | `string?` | Visit after which rule is evaluated |
| `evaluatedAfterAssessmentId` | `string?` | Assessment result that triggers evaluation |
| `conditionExpression` | `string` / structured AST | Machine-evaluable condition (future expression language) |
| `actionType` | enum | e.g. `switchArm`, `modifyDose`, `addIntervention`, `changeVisitSchedule`, `addAssessment`, `discontinueTreatment`, `reanchorSchedule` |
| `targetArmId` | `string?` | Destination study arm when action changes arm assignment |
| `targetVisitDefinitionId` | `string?` | Visit schedule entry added, removed, or modified |
| `targetAssessmentScheduleRuleId` | `string?` | Assessment rule added, removed, or modified |
| `scheduleImpact` | object? | Structured description of visit/anchor/window changes |
| `treatmentImpact` | object? | Dose, frequency, intervention changes |
| `assessmentImpact` | object? | Added/removed/modified assessments |
| `protocolStatusImpact` | object? | Treatment failure, discontinuation, amendment triggers |
| `narrativeSectionIds` | `string[]?` | Sections whose prose must reflect this rule |
| `requiresUserApproval` | `boolean?` | Whether applying the rule requires explicit author approval |
| `metadata` | `Record<string, unknown>?` | Migration, traceability, SDE hooks |

**Relationship to Stage 2 models:**

| Stage 2 model | Conditional logic extends… |
|---------------|---------------------------|
| `visitSchedule` | Dynamic visit insertion, re-anchoring decisions beyond static per-visit policies |
| `assessmentScheduleRules` | Conditional add/remove/modify of intersections |
| `clinicalDesign` | Arm transitions, new interventions, endpoint-driven pathway changes |
| Generated `schedule` | **Derived view** may reflect active pathway state; not the authoritative store for branching rules |

**Validation goals (future):**

| Goal | Description |
|------|-------------|
| Contradictory rules | Two rules with incompatible actions for the same trigger/condition |
| Unreachable pathways | Pathway branches that can never be entered |
| Missing downstream visits | Arm/schedule transition references visits not defined in `visitSchedule` |
| Conflicting arm transitions | Illegal or ambiguous arm switches |
| Circular logic chains | Rule A triggers B triggers A (or longer cycles) |
| Narrative impact | Identify `narrativeSectionIds` and linked prose affected by conditional behavior |

**Implementation status:** Conditional Protocol Logic is **not** part of the initial Stage 2 generator implementation. It is an **architectural extension anticipated in future stages** (SoA Configuration UI expansion, validation platform, Copilot, amendment workflows). Stage 2 may store lightweight `condition` fields on rules as a **precursor**, but full branching logic is out of scope until the dedicated model exists.

### 8.5 SoA Configuration UI — Tab Model (Future)

Within **SoA Configuration**, tabs follow the **matrix foundation workflow** (§8.0). Tab rail order and Stage 2e PR sequence align with this product logic—not clinical-design hierarchy:

```
[ Overview ]
[ SoA Assessments ]  [ Visits ]  [ Schedule Rules ]
[ Epochs ]  [ Activities ]  [ Elements ]
[ Arms ]
[ Conditional Protocol Logic — future ]
```

| Step | Tab | Binds to | Matrix role |
|------|-----|----------|---------------|
| 1 | **SoA Assessments** | `soaAssessmentDefinitions`, clinical design assessment links, row order and presentation | Y axis |
| 2 | **Visits** | `visitSchedule.anchors`, `visitSchedule.visitDefinitions`, windows, re-anchor/ripple policies, display metadata | X axis |
| 3 | **Schedule Rules** | `assessmentScheduleRules` — required, timing, arm restrictions | Cells |
| 4 | **Epochs / Activities / Elements** | `clinicalDesign` epochs, assessments, elements; relationships | Grouping & narrative linkage |
| 5 | **Arms** | `clinicalDesign.studyArms` | Branching scope for rules and future CPL |
| 6 | **Conditional Protocol Logic** | Future `ProtocolDecisionRule` / `ConditionalPathwayRule` catalog | Pathway branching |

Stage **2e** delivers the matrix foundation (steps 1–3) as read-only views first, then CRUD editors. Steps 4–6 follow in Stage 2e tail / 2f / Stage 3. The **Conditional Protocol Logic** tab remains a read-only placeholder until the domain model and validators exist.

**Implementation note:** Visits read-only UI shipped in 2e PR 2 before Assessments (prior plan order). Remaining 2e work follows §8.0 sequence; shell tab rail will be reordered to match.

---

## 9. Generated SoA Pipeline

### 9.1 `generateSchedule(document)` 

Pure function (Stage 2d):

```
Input:
  soaAssessmentDefinitions
  clinicalDesign.assessments
  visitSchedule.anchors
  visitSchedule.visitDefinitions
  assessmentScheduleRules

Output:
  ScheduleDefinition

Steps:
  1. Resolve anchor catalog; validate anchorId references
  2. Build visit columns from visitSchedule.visitDefinitions (sorted by order)
  3. Build assessment rows from soaAssessmentDefinitions (sorted by order)
  4. Emit cells for each assessmentScheduleRule
  5. Render timepoint strings from ScheduleAnchor + offsets + windows
  6. Attach generation metadata (generatedAt, sourceHash)
```

### 9.2 When generation runs

| Trigger | Action |
|---------|--------|
| Load seed / import | Generate if `schedule.sourceHash` stale or missing |
| Mutation to visitSchedule | Regenerate schedule + notify subscribers |
| Mutation to assessmentScheduleRules | Regenerate schedule |
| Mutation to clinicalDesign.assessment (delete) | Block or remove orphan rules (validation) |

### 9.3 Store integration pattern

Mirror Stage 1:

```
visitScheduleMutations.ts
assessmentScheduleRuleMutations.ts
  → mutateProtocolDocument()
  → generateSchedule(draft)
  → draft.schedule = generated
  → metadata.updatedAt
  → subscribe()
```

Selectors **`getVisits()` / `getAssessments()` / `getSoACells()`** continue to read `document.schedule`—no App changes until UI edits schedule sources.

---

## 10. Narrative Consistency and Update Governance

Full narrative linting belongs to **Roadmap Stage 4**; Stage 2f introduces **scaffolding** and rule stubs. **Narrative Update Governance** (§10.3) defines the long-term system behavior for keeping prose aligned with structured configuration.

### 10.1 Future validation categories

| Check | Example |
|-------|---------|
| Narrative → schedule | Prose says “Screening within 28 days prior to randomization” but no visit window matches |
| Schedule → narrative | SoA includes PK sampling not mentioned in Section 8 |
| Re-anchor mismatch | Narrative says imaging independent of dose delays; visit uses `reanchorToActualVisitDate` |
| Policy mismatch | Narrative describes fixed Q3W cycles; model uses rolling re-anchor on treatment visits |
| Window mismatch | Narrative ±7 days; rule says ±3 days |
| Assessment continuity | Narrative says AE collection from consent; no `continuous` rule on AE assessment |
| Anchor undefined | Visit column in narrative with no `ScheduleAnchor` / `anchorId` |
| Orphan references | `linkedSectionId` on rule points to missing section |

See also §5.7 for anchor- and re-anchor-specific validation codes.

### 10.2 Scaffolding deliverables (2f)

| Deliverable | Description |
|-------------|-------------|
| `validateScheduleConsistency(document)` | Returns errors/warnings; no narrative NLP initially |
| Rule ids | e.g. `SCHEDULE_NARRATIVE_WINDOW_MISMATCH` (stub) |
| `scheduleConsistencyFixtures/` | JSON pairs: valid / invalid schedule models |
| CLI | `npm run validate:schedule` (optional) |
| Element cross-refs | Map known narrative fields (e.g. `elements` in Section 1.3) to schedule ids when present |

**Phase 1 of narrative validation:** structural cross-reference only (ids, sections, numeric windows in structured element values)—not free-text NLP.

### 10.3 Narrative Update Governance

**Core principle:** Structured protocol configuration is **authoritative**. Narrative prose in `sections` / `elements` is a **governed rendering** of clinical design, visit schedule, assessment rules, generated SoA configuration, and (future) conditional protocol logic—not an independent source of truth.

Any change to the following must automatically trigger **narrative impact analysis**:

| Structured source | Examples of narrative impact |
|-------------------|------------------------------|
| **Clinical Design** | Objectives, endpoints, assessments, arms, populations, interventions |
| **Visit Schedule** | Visit timing, windows, anchors, re-anchoring behavior |
| **AssessmentScheduleRules** | Required assessments at visits, timing notes, arm restrictions |
| **Generated SoA configuration** | `soaAssessmentDefinitions`, visit display metadata, generated matrix changes |
| **Conditional Protocol Logic** (future) | Branching pathways, arm switches, dose modifications, discontinuation criteria |

**System behavior (target architecture):**

1. **Detect affected narrative sections** — map structured changes to `sectionRef`, `linkedSectionId`, `narrativeSectionIds`, and known element cross-refs.
2. **Flag protocol inconsistencies** — surface unresolved mismatches between structured config and existing prose; never silently accept drift.
3. **Generate proposed narrative updates automatically** — produce draft language from structured sources (visit windows, assessment timing, conditional actions).
4. **Present proposed updates to the user** — review UI with diffs, section context, and traceability to the triggering configuration change.
5. **Allow the user to edit proposed language** — author retains control over final wording; proposals are starting points, not forced replacements.
6. **Require user approval before committing narrative changes** — no auto-write of prose to the authoritative document without explicit approval (unless a future policy explicitly allows batch approval).
7. **Maintain an audit trail** of:
   - generated language (machine proposal)
   - user edits (author modifications to proposal)
   - approvals (committed narrative updates)
   - rejections (declined proposals with reason)
   - deferred items (acknowledged but postponed)

**Governance stance:** The system must **never silently ignore inconsistencies**. Deprecated interaction patterns such as *“Would you like me to generate language, flag inconsistency, or ignore?”* are replaced by:

> The system automatically identifies affected narrative sections, generates proposed language updates, and tracks unresolved inconsistencies until the user approves or otherwise resolves them.

**Relationship to other roadmap stages:**

| Stage / capability | Role |
|--------------------|------|
| **Stage 2f** | Structural consistency scaffolding; section/id cross-refs; stub validation codes |
| **Roadmap Stage 4 (Validation Platform)** | Full inconsistency detection, governance workflows, validation issue records |
| **Roadmap Stage 5 (Copilot)** | AI-assisted proposal generation within governance guardrails |
| **Amendment management** | Impact analysis spans structured + narrative deltas; audit trail supports protocol amendments |

**Out of scope for Stage 2 implementation:** approval UI, automatic prose mutation, Copilot integration, and amendment packaging. This section documents **intent** so Stage 2 structured models (`linkedSectionId`, `sourceSectionId`, future `narrativeSectionIds`) are authored with downstream governance in mind.

---

## 11. Design Principles (Stage 2)

1. **Visit schedule is declarative**—anchors, policies, and windows; not simulated dates in authoring MVP.  
2. **Anchors are first-class**—`ScheduleAnchor` catalog + `anchorId` on visits; not embedded only in `timepoint` strings.  
3. **Re-anchoring is explicit**—`reanchorPolicy` and `ripplePolicy` document fixed vs rolling behavior per EDC/SDE practice.  
4. **Clinical design owns assessment identity**—rules reference `clinicalDesign.assessments[].id`.  
5. **One intersection source**—`assessmentScheduleRules`; generated cells are derived.  
6. **Mutations in domain layer**—not in `ScheduleOfActivities.tsx`.  
7. **Backward-compatible export**—JSON still contains `schedule` for consumers; `visitSchedule` + rules are authoritative.  
8. **Small PRs**—sub-phases 2a–2f map to narrow commits.  
9. **Validate before UI**—domain + generation + smoke scripts before SoA configuration UI.  
10. **Do not break Stage 1**—graph editing, relationship CRUD, and parity selectors remain stable.

---

## 12. Stage 2 Phases — Incremental PRs

### Stage 2a — Visit Schedule domain model

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S2a-1** | Types: `ScheduleAnchor`, `VisitScheduleModel`, `VisitScheduleEntry` | M | Add to `types.ts`; seed gains `visitSchedule.anchors` + `visits` parallel to legacy `schedule` |
| **S2a-2** | `visitSchedule/` module | M | Lookup helpers for anchors + visits; `findScheduleAnchor()`, `collectVisitScheduleEntries()` |
| **S2a-3** | CRUD mutations | M | Anchor + visit entry CRUD; `createScheduleAnchor`, `updateVisitScheduleEntry`, etc. |
| **S2a-4** | Link to clinical design | S | Require or warn on `clinicalDesignVisitId` on anchors/visits; block delete if rules reference |
| **S2a-5** | `validateVisitSchedule()` | S | Unique ids, valid `anchorId`, valid arm refs, anchor catalog integrity |
| **S2a-6** | Smoke script | S | Round-trip mutations; seed still passes `validate:protocol` |

**Exit criteria:** `visitSchedule` in export JSON; mutations + validation; **no change** to SoA UI yet.

---

### Stage 2b — Visit window and re-anchoring policy model

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S2b-1** | Window + policy types | M | `VisitWindow`, `MissedVisitPolicy`, `ReanchorPolicy`, `RipplePolicy`, `VisitScheduleDefaults` (§5.3–5.4) |
| **S2b-2** | Window + policy validation | S | Asymmetric bounds, fixed visits, re-anchor vs ripple consistency |
| **S2b-3** | `renderVisitTimepoint(entry, anchor)` | S | Generate display string for SoA column header from anchor + offsets |
| **S2b-4** | Seed migration | M | Map existing `schedule.visits[].timepoint` → anchors + structured windows |
| **S2b-5** | Extend smoke + validate | S | Examples A/B/C policy fixtures; hybrid imaging vs treatment tests |

**Exit criteria:** Screening / C1D1 / C1D15 / FU examples encoded structurally in seed.

---

### Stage 2c — AssessmentScheduleRule model

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S2c-1** | `AssessmentScheduleRule` types | M | Full schema §7.2 |
| **S2c-2** | Rule mutations | M | CRUD; validate assessment + visitSchedule ids exist |
| **S2c-3** | Migrate seed cells → rules | L | Derive initial rules from `schedule.cells` + clinical design links |
| **S2c-4** | Relationship consistency check | S | Warn if `performed-at` graph edge missing or mismatched |
| **S2c-5** | Assessment timing validation | S | `independentOfDoseDelay` vs visit `reanchorPolicy` / `ripplePolicy` (Example C) |

**Exit criteria:** Rules populated for PROTO-XYZ-301; validation passes; cells still in seed until 2d.

---

### Stage 2d — Generate SoA matrix from schedule rules

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S2d-1** | `generateSchedule(document)` | L | Pure generator §9; inputs include `visitSchedule.anchors` |
| **S2d-2** | Wire into mutations | M | **Implemented (PR 4):** auto-regenerate `document.schedule` cache on visit/rule/anchor mutations |
| **S2d-3** | Staleness / `sourceHash` | S | **Implemented (PR 2 + PR 4):** staleness detection + auto-refresh on mutation |
| **S2d-4** | Parity strategy | M | **Implemented (PR 3):** split legacy selector parity (`test:parity`) from generated schedule parity (`test:schedule-parity`); fixtures in `parity/fixtures/generatedSchedule/` |
| **S2d-5** | `npm run smoke:schedule-generation` | S | Assert generated cells match expected count for seed |

**Exit criteria:** `schedule` in store is generated; selectors unchanged; parity green.

---

### Stage 2e — SoA configuration UI (matrix foundation workflow)

**Product workflow order:** SoA Assessments → Visits → Schedule Rules → Epochs/Activities/Elements → Arms → Conditional Logic placeholder.

| ID | Task | Complexity | Description | Status |
|----|------|------------|-------------|--------|
| **S2e-0** | SoA Configuration shell + tab rail + overview | M | `SOA-SHELL`, `SOA-OVERVIEW`, read-only grid band | **Done** (`54668b8`) |
| **S2e-1** | SoA Assessment Definitions read-only | M | List/detail from `soaAssessmentDefinitions[]`; validation badges | **Next** |
| **S2e-2** | SoA Assessment Definitions CRUD | M | Catalog list/edit; row order; `clinicalDesignAssessmentId`, `linkedSectionId` | Planned |
| **S2e-3** | Study Visit Definitions read-only | M | List/detail from `visitSchedule` + anchors; validation badges | **Done** (`7d6287e`) |
| **S2e-4** | Visit Definitions + Schedule Anchors CRUD | M | §5.8 controls; write-through to store mutations | Planned |
| **S2e-5** | Assessment Schedule Rules read-only | M | Matrix-style rule list; filter by visit/assessment; link to grid cells | Planned |
| **S2e-6** | Assessment Schedule Rules CRUD | M | Toggle required / add rule; arm restrictions when arms exist | Planned |
| **S2e-7** | Grid click → rule focus | S | Cell click opens rule editor for `(visitId, assessmentId)` | Planned |
| **S2e-8** | Tab rail reorder + empty-state workflow hints | S | Rail order matches §8.5; “next step” prompts per workflow | Planned |
| **S2e-9** | No direct cell matrix editing | S | Enforce write-through to rules only | Planned |

**Exit criteria (Stage 2e):** User defines assessment rows and visit columns, adds/removes a rule, and sees the grid update via store regen; export reflects rules. No direct `schedule.cells` editing.

**Follow-on (Stage 2e tail / 2f — not matrix foundation):**

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S2e-10** | Epochs / Activities / Elements read-only → CRUD | M | Grouping tabs after matrix foundation |
| **S2e-11** | Study Arms read-only → CRUD | M | Arms before arm-scoped rule authoring and CPL |
| **S2e-12** | Conditional Logic tab placeholder (maintain) | S | Read-only explainer until Stage 3 CPL domain |

---

### Stage 2f — Narrative consistency validation scaffolding

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S2f-1** | `validateScheduleConsistency()` | M | Structural checks §5.7 + §10.1 |
| **S2f-2** | Stub narrative cross-refs | S | Link Section 1.3 elements to schedule ids where seeded |
| **S2f-3** | CLI / dev logging | S | `npm run validate:schedule` |
| **S2f-4** | Validation issue records | S | Optional append to `validationIssues` shape (static demo) |
| **S2f-5** | Documentation | S | ARCHITECTURE.md schedule linkage update |

**Exit criteria:** Known seed inconsistencies detected as warnings; no NLP required.

---

## 13. Recommended Implementation Sequence

```
S2a-1 → S2a-2 → S2a-3 → S2a-4 → S2a-5 → S2a-6     (visit schedule domain)
        ↓
S2b-1 → S2b-2 → S2b-3 → S2b-4 → S2b-5               (windows + re-anchor policies)
        ↓
S2c-1 → S2c-2 → S2c-3 → S2c-4 → S2c-5               (assessment rules)
        ↓
S2d-1 → S2d-2 → S2d-3 → S2d-4 → S2d-5               (generated SoA)
        ↓
S2e-0 → S2e-1 → S2e-2 → S2e-3 → S2e-4               (shell; assessments; visits CRUD)
        → S2e-5 → S2e-6 → S2e-7 → S2e-8 → S2e-9     (rules; grid focus; rail reorder)
        → S2e-10 → S2e-11 → S2e-12                    (epochs/activities/elements; arms; CPL placeholder)
        ↓
S2f-1 → S2f-2 → S2f-3 → S2f-4 → S2f-5               (consistency scaffolding)
```

**Stage 2e matrix foundation (user-facing order):**

| Step | PR focus | Delivers |
|------|----------|----------|
| 0 | Shell | Tab rail, overview, read-only grid (**done**) |
| 1 | SoA Assessments read-only | Y-axis catalog visibility (**next**) |
| 2 | SoA Assessments CRUD | Row catalog authoring |
| 3 | Visits read-only | X-axis catalog visibility (**done**, shipped early) |
| 4 | Visits + anchors CRUD | Visit/anchor authoring |
| 5 | Schedule Rules read-only | Cell/intersection visibility |
| 6 | Schedule Rules CRUD | Matrix intersection authoring |
| 7+ | Grid click-through, validation inspector, rail reorder | Write-through UX |

**First PR recommendation (historical):** **S2a-1 + S2a-2** — `ScheduleAnchor` types + read helpers.

**Next PR recommendation (revised):** **S2e-1** — SoA Assessment Definitions read-only list + detail panel.

**MVP milestone (Stage 2d):** Generated SoA matches seed matrix; graph and document views unchanged.

**Full Stage 2 milestone:** 2a–2f complete; schedule authoring moves off hand-edited cells.

---

## 14. Definition of Done (Stage 2 Track)

### Domain

- [ ] `visitSchedule.anchors`, `visitSchedule.visits`, and `assessmentScheduleRules` exist in `ProtocolDocument`  
- [ ] Visit anchoring (`anchorId`, offsets), windows, and re-anchoring policies are structured fields  
- [ ] `generateSchedule()` produces `schedule` from anchors + visits + rules  
- [ ] Mutations regenerate schedule and touch `metadata.updatedAt`  
- [ ] `npm run validate:protocol` passes; schedule-specific validation added  

### Views

- [ ] SoA grid reads generated schedule (no separate mock state)  
- [ ] Minimal configuration UI edits **SoA assessment catalog**, visit windows, and rules in workflow order (Stage 2e)  
- [ ] Dependency graph still uses `clinicalDesign` + `relationships`  

### Integrity

- [ ] Rules reference valid assessment and visit schedule ids  
- [ ] Anchors reference valid visits where `sourceVisitId` is set  
- [ ] Orphan / mismatch warnings for graph vs rules  
- [ ] Re-anchor / ripple policy conflicts flagged (Example C hybrid)  
- [ ] Narrative consistency scaffolding runs (Stage 2f)  

### Verification

- [ ] `npm run build`  
- [ ] `npm run test:parity` (legacy selector outputs; unchanged policy)  
- [ ] `npm run test:schedule-parity` (generated schedule baseline + legacy replacement candidacy)  
- [ ] `npm run validate:protocol`  
- [ ] `npm run smoke:clinical-design` (Stage 1 regression)  
- [ ] `npm run smoke:schedule-generation` (Stage 2d+)  

---

## 15. Out of Scope (Stage 2)

| Item | Deferred to |
|------|-------------|
| **Conditional Protocol Logic** (`ProtocolDecisionRule` / `ConditionalPathwayRule`) | Post–Stage 2 SoA Configuration extension; see §8.4 |
| **Conditional Protocol Logic UI tab** | SoA Configuration UI after domain model + validators exist |
| **Narrative Update Governance** (approval workflows, auto-proposals, audit trail) | Roadmap Stage 4+; scaffolding only in 2f; see §10.3 |
| Standards Repository ingestion | Roadmap Stage 2 (standards track) |
| CDISC controlled terminology enforcement | Roadmap Stage 2–4 |
| Full narrative NLP consistency | Roadmap Stage 4 |
| Live validation engine UI | Roadmap Stage 4 |
| Execution-layer visit date simulation | Post–Stage 2 operational module |
| Epoch / study arm configuration UI | Stage 2e-10 / 2e-11 (after matrix foundation) |
| CDASH / SDTM mapping on cells | Roadmap Stage 6+ |
| Copilot-generated schedule proposals | Roadmap Stage 5 (within governance) |
| Supabase persistence | Parallel track |

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Dual truth (`schedule` hand-edited + generated) | `sourceHash`; dev warnings; remove hand-editing path in 2d |
| Graph `performed-at` vs rules diverge | Consistency validator in 2c; optional auto-sync policy documented |
| Seed migration breaks parity | Phased migration; generate-from-rules must reproduce current matrix |
| Scope creep into full SoA product | 2e is minimal; defer Conditional Protocol Logic tab and full branching UI to post–Stage 2 (§8.4) |
| Conditional logic modeled only as prose | Future `ProtocolDecisionRule` model; narrative governance tracks impacted sections (§10.3) |
| Hybrid fixed + rolling policies misconfigured | Example C fixtures in 2b/2f; `IMAGING_ROLLING_CONFLICT` validation |
| M11 spec gap on visit timing / re-anchoring | Document extensions in ARCHITECTURE.md; align with EDC/SDE anchor semantics |
| Stage 1 regression | Keep smoke:clinical-design in CI for every Stage 2 PR |

---

## 17. Verification Commands

```bash
npm run build
npm run test:parity
npm run test:schedule-parity
npm run validate:protocol
npm run compare:generated-schedule
npm run smoke:clinical-design          # Stage 1 regression
npm run smoke:schedule                 # visit schedule + cache regeneration smoke
# After S2d:
npm run generate:schedule-parity-fixtures  # refresh PROTO-XYZ-301 generated schedule fixtures
# After S2f:
npm run validate:schedule              # proposed
```

### Generated schedule parity status (Stage 2d Phase 2 PR 3)

| Check | Status | Notes |
|-------|--------|-------|
| Fixture parity (`visits`, `assessments`, `cells`, `metadata`) | **PASS** | Golden snapshot of `generateScheduleFromRules(PROTO-XYZ-301)` |
| Cache vs live generation | **PASS** | `document.schedule` matches generator after seed alignment + auto-regen |
| Accepted legacy content diffs | **0** | Tumor-imaging notes adopted in seed/generated cache (PR 5) |
| Legacy selector parity (`test:parity`) | **PASS** | Fixtures reflect authoritative generated cache selectors |
| Authoritative swap | **Done (PR 5)** | Selectors/export use generated cache; debug preview via `{ generated: true }` |

---

## 18. Roadmap Implications

This section consolidates how Stage 2 deliverables connect to future product capabilities.

### 18.1 What Stage 2 delivers

Stage 2 establishes the **structured scheduling and SoA configuration foundation**:

| Deliverable | Status / direction |
|-------------|-------------------|
| Clinical Design graph editing | Stage 1 (complete); Stage 2 links schedule to design entities |
| Visit Schedule Model | Anchors, visit definitions, windows, re-anchor/ripple policies |
| AssessmentScheduleRules | Authoritative assessment × visit intersections |
| Generated SoA | `generateScheduleFromRules()` from visit definitions + SoA catalog + rules |
| SoA metadata ownership | `soaAssessmentDefinitions`, visit display metadata; legacy `schedule` as cache until authoritative swap |

### 18.2 What Stage 2 explicitly does not deliver

| Capability | Rationale |
|------------|-----------|
| Conditional Protocol Logic | Branching behavior exceeds visit windows + static rules; requires dedicated decision-rule model (§8.4) |
| Full Narrative Update Governance | Requires validation platform, proposal UI, approval flows, audit persistence (§10.3) |
| Authoritative generated schedule swap | Regen hooks, parity split, export policy — remaining Stage 2d work |

### 18.3 Future extensions and their dependencies

```
Stage 2 (this plan)
  clinicalDesign + visitSchedule + soaAssessmentDefinitions
  + assessmentScheduleRules → generated schedule
        │
        ├─► SoA Configuration UI (2e) — matrix foundation workflow
        │     [ SoA Assessments ] → [ Visits ] → [ Schedule Rules ]
        │     → [ Epochs / Activities / Elements ] → [ Arms ]
        │     → [ Conditional Protocol Logic — future ]
        │
        ├─► Conditional Protocol Logic (post–Stage 2)
        │     arm / dose / visit / assessment / status branching
        │
        └─► Narrative Update Governance (Stage 4+)
              impact analysis ← all structured sources above
              proposals + approvals + audit trail
                    │
                    └─► Copilot (Stage 5) — generates proposals within governance
                    └─► Amendment management — structured + narrative change packages
```

### 18.4 Authority model (end state)

| Layer | Authority |
|-------|-----------|
| Clinical Design | WHAT the trial evaluates and includes |
| Visit Schedule + AssessmentScheduleRules + SoA catalog | WHEN and HOW activities occur at visits (Assessment × Visit matrix) |
| Conditional Protocol Logic (future) | WHY/WHEN pathways branch based on outcomes |
| Generated SoA matrix | Derived view for grid, export, SDE-oriented consumers |
| Narrative (`sections` / `elements`) | Governed prose driven by structured sources; updated through approval workflow |

Structured configuration drives narrative updates. Manual Word-style editing of schedule tables or branching prose without reflecting structured changes is a **consistency violation**, not a supported authoring path.

---

## 19. Success Statement

Stage 2 succeeds when a protocol author can:

- Define **Screening** as anchored to randomization with a −28/+0 day window  
- Define **C1D15** as Day 15 ±3 from the **C1D1 anchor**, with **fixed** downstream cycles when the patient is late (Example A)  
- Define **treatment visits** that **re-anchor** on delay and **imaging** that stays q8w from first dose regardless of dose delays (Example C)  
- Persist **`visitSchedule.anchors`**, **`visitSchedule.visits`**, and **`assessmentScheduleRules`**  
- See the **SoA grid and JSON export regenerate** from those sources  
- Receive validation warnings when **re-anchor policies conflict** with assessment timing rules or narrative intent  

That proves M11 Studio owns the operational **when** of the trial—including **anchor visits, visit windows, and re-anchoring behavior** as understood in EDC/SDE configuration—not just the **what** captured in ICH M11 clinical design structure.
