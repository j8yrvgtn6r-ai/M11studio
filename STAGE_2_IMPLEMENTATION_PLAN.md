# STAGE_2_IMPLEMENTATION_PLAN.md

# Akyrian M11 Studio — Stage 2 Implementation Plan

**Stage:** 2 — Visit Schedule Model & SoA Configuration Architecture  
**Focus:** Operational *when* of study visits, assessment timing rules, and generated Schedule of Activities  
**Status:** Planned  
**Baseline:** Stage 1a complete (`89ee8bf` — clinical design graph editing foundation)  
**Last updated:** 2026-06-04

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
| **This plan (Stage 2 track)** | Visit Schedule Model, windows, policies, assessment rules, generated SoA |
| Roadmap Stage 2 (Standards Repository) | Parallel / later; terminology hooks referenced but not implemented here |
| Roadmap Stage 3 (SoA Configuration UI) | **Stage 2e** in this plan delivers minimal UI on top of domain model |
| Roadmap Stage 4 (Validation Platform) | **Stage 2f** scaffolds narrative ↔ schedule consistency checks |

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
│                          │  (`anchors[]` + `visits[]`)          │
├──────────────────────────┼──────────────────────────────────────┤
│  assessmentScheduleRules │  HOW: assessment occurs at visit,      │
│  (Stage 2 — source)      │  requiredness, per-assessment windows│
├──────────────────────────┼──────────────────────────────────────┤
│  schedule                │  VIEW: generated SoA matrix          │
│  (Stage 2 — derived)       │  (visits, assessments, cells)      │
├──────────────────────────┼──────────────────────────────────────┤
│  elements / sections     │  NARRATIVE: prose fields (future      │
│  (existing)              │  validation target in 2f)            │
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
| `assessmentId` | `string` | **Required.** Canonical: `clinicalDesign.assessments[].id`. During Stage 2c→2d migration, legacy `schedule.assessments[].id` values are accepted with validation warnings and explicit metadata links (§7.2.1). |
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

### 7.2.1 Assessment reference strategy (Stage 2c hardening)

**Canonical rule:** `AssessmentScheduleRule.assessmentId` should reference **`clinicalDesign.assessments[].id`** because clinical design owns assessment identity (WHAT). Visit schedule owns WHEN. Assessment schedule rules link WHAT × WHEN.

**Transitional model (PROTO-XYZ-301 seed):**

| Layer | Role | Id examples |
|-------|------|-------------|
| `clinicalDesign.assessments[]` | Canonical assessment entities | `assess-1`, `assess-2`, `assess-3` |
| `schedule.assessments[]` | Generated/display SoA row ids until Stage 2d | `a1`–`a12` with optional `entityId` → clinical design |
| `assessmentScheduleRules[]` | Authoritative intersections | Prefer `assess-*`; seed currently uses `a*` with metadata bridge |

**Metadata bridge (required for schedule-layer refs):**

```typescript
metadata: {
  assessmentRefKind: 'clinicalDesign' | 'schedule';
  clinicalDesignAssessmentId?: string;  // canonical WHAT id when known
  scheduleAssessmentId?: string;      // legacy/generated SoA row id
  scheduleVisitId?: string;           // migration trace to hand-authored cells
}
```

**Validation policy:**

| Code | Severity | When |
|------|----------|------|
| `assessment_schedule_rule_schedule_assessment_ref` | warning | `assessmentId` is a schedule row id |
| `assessment_schedule_rule_prefer_clinical_design_assessment` | warning | schedule row has `entityId` but rule still uses schedule id |
| `assessment_schedule_rule_missing_ref_metadata` | warning | schedule-layer ref without `metadata.assessmentRefKind` |

**Stage 2d generation mapping:**

1. Resolve rule `assessmentId` → clinical design assessment (direct or via `metadata.clinicalDesignAssessmentId`).
2. Emit `schedule.assessments[]` row (create or match by `entityId`).
3. Emit `schedule.cells[]` using generated visit column ids + schedule assessment ids.

**Migration path:** Before enabling generation, migrate rules where `schedule.assessments[].entityId` exists (e.g. `a7`→`assess-3`, `a8`→`assess-1`) to canonical clinical design ids. SoA-only rows (`a1`–`a6`, `a9`–`a12`) remain on schedule ids until clinical design entities are authored or synthetic rows are promoted.

### 7.3 Relationship to dependency graph

When `assessmentScheduleRule` is created for `(assessmentId, visitScheduleId)`:

- **`generateSchedule()`** emits a `schedule.cells[]` entry.  
- Optionally sync **`relationships`** with `kind: 'performed-at'` if not already present (Stage 2c policy: prefer single source—rules generate both cells and relationships, or validate alignment).

Recommended: **AssessmentScheduleRules are authoritative for SoA cells**; `performed-at` relationships are **validated for consistency**, not independently authored for the same pair.

---

## 8. SoA Configuration Layer

### 8.1 What the configuration layer is

The **SoA Configuration Layer** is the combined editable model:

| Component | Role in configuration |
|-----------|-------------------------|
| **Schedule anchors** | `visitSchedule.anchors` — anchor visit / event catalog |
| Assessment rows | Derived from `clinicalDesign.assessments` (+ display metadata) |
| Visit columns | Derived from `visitSchedule.visits` |
| Assessment × Visit intersections | **`assessmentScheduleRules`** |
| Visit anchoring | `anchorId`, offsets, nominal day/week |
| Visit windows | `windowBeforeDays`, `windowAfterDays` |
| Assessment-specific windows | Rule-level overrides |
| Missed / delayed visit policies | `missedVisitPolicy`, `reanchorPolicy`, `ripplePolicy` |
| Conditional rules | `condition`, `armRestrictions` on rules and visits |

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
| `ScheduleVisit.id` | `visitSchedule.visits[].id` (or mapped column id) |
| `ScheduleVisit.entityId` | `clinicalDesignVisitId` |
| `ScheduleVisit.label` | `visitSchedule.visits[].name` |
| `ScheduleVisit.order` | `visitSchedule.visits[].order` |
| `ScheduleVisit.timepoint` | **Rendered string** from anchor + offsets + window (§5, §6) |
| `ScheduleAssessment.entityId` | `assessmentId` from clinical design |
| `ScheduleCell.required` | `AssessmentScheduleRule.required` |
| `ScheduleCell.notes` | `AssessmentScheduleRule.notes` |

---

## 9. Generated SoA Pipeline

### 9.1 `generateSchedule(document)` 

Pure function (Stage 2d):

```
Input:
  clinicalDesign.assessments
  visitSchedule.anchors
  visitSchedule.visits
  assessmentScheduleRules

Output:
  ScheduleDefinition

Steps:
  1. Resolve anchor catalog; validate anchorId references
  2. Build visit columns from visitSchedule.visits (sorted by order)
  3. Build assessment rows from clinicalDesign.assessments
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

## 10. Narrative Consistency (Stage 2f Scaffolding)

Full narrative linting belongs to **Roadmap Stage 4**; Stage 2f introduces **scaffolding** and rule stubs.

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
| **S2d-2** | Wire into mutations | M | Auto-regenerate on visit/rule changes |
| **S2d-3** | Staleness / `sourceHash` | S | Detect manual schedule drift in dev |
| **S2d-4** | Parity strategy | M | Update fixtures or split “legacy schedule” vs “generated schedule” tests |
| **S2d-5** | `npm run smoke:schedule-generation` | S | Assert generated cells match expected count for seed |

**Exit criteria:** `schedule` in store is generated; selectors unchanged; parity green.

---

### Stage 2e — Minimal SoA configuration UI

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S2e-1** | Visit schedule + anchor panel | M | List/edit anchors, visit windows, re-anchor policies (§5.8) |
| **S2e-2** | Rule editor stub | M | Toggle required / add rule; anchor + offset preview |
| **S2e-3** | SoA grid refresh | S | `subscribe()` already patterns from Stage 1 |
| **S2e-4** | Cell click → rule focus | S | Navigate from grid cell to rule metadata |
| **S2e-5** | No direct cell matrix editing | S | Enforce write-through to rules only |

**Exit criteria:** User can add/remove a rule and see grid update; export reflects rules.

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
S2e-1 → S2e-2 → S2e-3 → S2e-4 → S2e-5               (minimal UI)
        ↓
S2f-1 → S2f-2 → S2f-3 → S2f-4 → S2f-5               (consistency scaffolding)
```

**First PR recommendation:** **S2a-1 + S2a-2** — `ScheduleAnchor` types + read helpers; seed gains `visitSchedule.anchors` without changing SoA behavior.

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
- [ ] Minimal configuration UI edits visit windows and rules (Stage 2e)  
- [ ] Dependency graph still uses `clinicalDesign` + `relationships`  

### Integrity

- [ ] Rules reference valid assessment and visit schedule ids  
- [ ] Anchors reference valid visits where `sourceVisitId` is set  
- [ ] Orphan / mismatch warnings for graph vs rules  
- [ ] Re-anchor / ripple policy conflicts flagged (Example C hybrid)  
- [ ] Narrative consistency scaffolding runs (Stage 2f)  

### Verification

- [ ] `npm run build`  
- [ ] `npm run test:parity` (updated policy documented)  
- [ ] `npm run validate:protocol`  
- [ ] `npm run smoke:clinical-design` (Stage 1 regression)  
- [ ] `npm run smoke:schedule-generation` (Stage 2d+)  

---

## 15. Out of Scope (Stage 2)

| Item | Deferred to |
|------|-------------|
| Standards Repository ingestion | Roadmap Stage 2 (standards track) |
| CDISC controlled terminology enforcement | Roadmap Stage 2–4 |
| Full narrative NLP consistency | Roadmap Stage 4 |
| Live validation engine UI | Roadmap Stage 4 |
| Execution-layer visit date simulation | Post–Stage 2 operational module |
| Epoch / study arm configuration UI | Stage 2+ or parallel epic |
| CDASH / SDTM mapping on cells | Roadmap Stage 6+ |
| Copilot-generated schedule proposals | Roadmap Stage 5 |
| Supabase persistence | Parallel track |

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Dual truth (`schedule` hand-edited + generated) | `sourceHash`; dev warnings; remove hand-editing path in 2d |
| Graph `performed-at` vs rules diverge | Consistency validator in 2c; optional auto-sync policy documented |
| Seed migration breaks parity | Phased migration; generate-from-rules must reproduce current matrix |
| Scope creep into full SoA product | 2e is minimal; defer epochs/conditions UI |
| Hybrid fixed + rolling policies misconfigured | Example C fixtures in 2b/2f; `IMAGING_ROLLING_CONFLICT` validation |
| M11 spec gap on visit timing / re-anchoring | Document extensions in ARCHITECTURE.md; align with EDC/SDE anchor semantics |
| Stage 1 regression | Keep smoke:clinical-design in CI for every Stage 2 PR |

---

## 17. Verification Commands

```bash
npm run build
npm run test:parity
npm run validate:protocol
npm run smoke:clinical-design          # Stage 1 regression
# After S2d:
npm run smoke:schedule-generation      # proposed
# After S2f:
npm run validate:schedule              # proposed
```

---

## 18. Success Statement

Stage 2 succeeds when a protocol author can:

- Define **Screening** as anchored to randomization with a −28/+0 day window  
- Define **C1D15** as Day 15 ±3 from the **C1D1 anchor**, with **fixed** downstream cycles when the patient is late (Example A)  
- Define **treatment visits** that **re-anchor** on delay and **imaging** that stays q8w from first dose regardless of dose delays (Example C)  
- Persist **`visitSchedule.anchors`**, **`visitSchedule.visits`**, and **`assessmentScheduleRules`**  
- See the **SoA grid and JSON export regenerate** from those sources  
- Receive validation warnings when **re-anchor policies conflict** with assessment timing rules or narrative intent  

That proves M11 Studio owns the operational **when** of the trial—including **anchor visits, visit windows, and re-anchoring behavior** as understood in EDC/SDE configuration—not just the **what** captured in ICH M11 clinical design structure.
