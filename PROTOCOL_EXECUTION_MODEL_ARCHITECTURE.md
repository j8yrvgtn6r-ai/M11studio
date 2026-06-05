# Protocol Execution Model Architecture

**Status:** Architecture (no implementation)  
**Scope:** Re-evaluation of M11 Studio’s protocol execution model, SoA authoring workflow, and long-term alignment with USDM, OpenStudyBuilder, and clinical operations  
**Authority:** Informs future domain, generator, CPL, narrative governance, and UI work. Does **not** supersede or modify [STAGE_2_IMPLEMENTATION_PLAN.md](./STAGE_2_IMPLEMENTATION_PLAN.md) or [SOA_CONFIGURATION_UI_ARCHITECTURE.md](./SOA_CONFIGURATION_UI_ARCHITECTURE.md) until explicitly adopted.  
**Baseline implementation:** Stage 2d–2e complete — generated SoA authoritative; `visitSchedule`, `soaAssessmentDefinitions`, `assessmentScheduleRules` as sources; matrix rendered as **Assessment × Visit**.

---

## 1. Purpose

M11 Studio’s current Stage 2 model correctly treats the **generated Schedule of Activities (SoA)** as a **read-only projection** of structured sources. However, the **authoring mental model** has been optimized around how the matrix is **drawn** (assessment rows × visit columns), not how protocols are **designed**, **executed at sites**, or **represented in USDM/OpenStudyBuilder-style study definitions**.

This document:

1. Defines a **protocol execution hierarchy** aligned with real-world clinical operations and industry reference models.
2. Compares that hierarchy to the **current Stage 2 architecture**.
3. Resolves the strategic question: should schedule intersections remain **Assessment × Visit** or evolve to **Assessment × Activity** (with activities scoped to visits).
4. Describes implications for **SoA generation**, **Conditional Protocol Logic (CPL)**, **narrative governance**, and **SoA Configuration UI/UX**.
5. Proposes a **migration strategy** without prescribing immediate implementation.

**Non-goals:** API design, schema diffs, code changes, or edits to existing implementation plans.

---

## 2. Conceptual hierarchy

### 2.1 Authoring stack (execution order)

Protocols are authored and executed top-down. Each level constrains the levels below it.

```
Arm
 └── Epoch
      └── Element
           └── Visit
                └── Activity
                     └── Assessment
```

| Level | Role | Author thinks… | Site operations think… |
|-------|------|----------------|-------------------------|
| **Arm** | Treatment pathway or branch | “Which schedule applies to this patient?” | Randomization / assignment drives which visit plan and rules apply |
| **Epoch** | High-level study phase | “What phase of the trial is this?” | Screening vs treatment vs follow-up vs OLE |
| **Element** | Continuous treatment intent or study state | “What kind of care period is the patient in?” | Chemo block, radiation, maintenance, observation—may span many visits |
| **Visit** | Patient–site interaction | “When does the patient come in?” | C1D1, C1D8, EOT, FU30—anchor, window, re-anchor |
| **Activity** | Operational work at a visit | “What happens during the encounter?” | Infusion, labs, imaging prep, discharge—timing, duration, resources |
| **Assessment** | Data collected | “What is recorded?” | Vitals, CBC, AE form, dose administered |

**Key distinction:** The **SoA matrix** is a **tabular summary** of *when assessments occur relative to visits* (and optionally grouped by epoch/arm). It is **not** the full execution model. Authors who only see Assessment × Visit are forced to collapse **activities**, **element context**, and **arm-specific pathways** into row labels and footnotes.

### 2.2 Worked example (Cycle 1 Day 1)

**Visit:** Cycle 1 Day 1  

**Activities (ordered within visit):**

1. Chemo Preparation  
2. Chemotherapy Infusion  
3. Observation  
4. Discharge Evaluation  

**Assessments (by activity):**

| Activity | Assessments |
|----------|-------------|
| Chemo Preparation | Weight, Vital Signs, CBC |
| Chemotherapy Infusion | Dose Administered, Start Time, End Time |
| Observation | Adverse Events, Blood Pressure |
| Discharge Evaluation | Physical Exam, Concomitant Medications |

**Implications:**

- Scheduling logic often attaches to **activities** (start infusion after labs; observation duration; discharge criteria).
- The classic SoA row “Vital Signs” may appear once in the matrix but is **authored** in the context of **Chemo Preparation** at **C1D1** on **Treatment Arm A** during **Treatment epoch** under **Maintenance element** (if applicable).
- Multiple activities at one visit explain **intra-visit timing** that a single Assessment × Visit cell cannot express without overloading `timingNote` on rules.

### 2.3 Reference alignment (USDM / OpenStudyBuilder / ICH M11)

| Reference | Hierarchy emphasis | M11 relevance |
|-----------|-------------------|---------------|
| **USDM / DDF** | Study design, arms, epochs, elements, activities, observations/assessments | Long-term export and standards interoperability require activity and element constructs, not only flat visit columns |
| **OpenStudyBuilder** | Metadata-driven study structure; activity-centric scheduling; visit windows and EDC strategies | Validates **activity-first** scheduling with assessments as collected data |
| **ICH M11** | Protocol narrative structure (sections, objectives, endpoints, assessments) | Narrative describes *what*; execution model describes *when/where/how* at sites |
| **EDC / SDE** | Arm-specific schedules, visit anchors, visit windows, activity workflows | Operational truth is arm-scoped visit plans with per-visit activity lists |

M11 should treat **clinical design** (`clinicalDesign.*`) as the **WHAT** graph and introduce (or formalize) an **execution schedule** layer as the **WHEN/WHERE/HOW** graph—distinct from the **SoA projection** (`document.schedule`).

---

## 3. Comparison against current Stage 2 architecture

### 3.1 What exists today (summary)

| Layer | Current source | Matrix relationship |
|-------|----------------|---------------------|
| Arms | `clinicalDesign.studyArms` | `armRestrictions` on `visitDefinitions` and `assessmentScheduleRules`; **no arm selector** on generated grid |
| Epochs | `clinicalDesign` epochs + optional `visitDefinition.epoch` | Grouping hint only; not a first-class column header tree |
| Elements | `clinicalDesign` elements + relationships | Graph/narrative linkage; weak binding to visit schedule |
| Visits | `visitSchedule.visitDefinitions` + `anchors` | **X axis** of generated matrix |
| Activities | `clinicalDesign.assessments` (misnamed overlap with “activity” in OSB) | **No operational visit-activity catalog**; `performed-at` relationships only |
| Assessments (SoA rows) | `soaAssessmentDefinitions` | **Y axis** of generated matrix |
| Intersections | `assessmentScheduleRules` (`assessmentId` + `visitDefinitionId`) | **Cells** — canonical **Assessment × Visit** |
| Projection | `document.schedule` (generated) | Read-only visits × assessments × cells |

### 3.2 Conceptual gaps

| Gap | Symptom in product | Risk |
|-----|-------------------|------|
| **Activity not in schedule source** | Authors schedule assessments at visits; intra-visit sequence is prose or `timingNote` | EDC mismatch; cannot model infusion vs pre-infusion labs |
| **Arm not a view scope** | Single matrix implies one schedule for all arms | Placebo vs active arm schedules conflated |
| **Element not tied to visit templates** | Element changes do not drive visit/activity templates | OLE or crossover transitions are manual |
| **Epoch as label only** | Column headers flat or weakly grouped | Cannot represent nested “Treatment → Cycles 1–8 → Day 1/4/8” |
| **Two assessment concepts** | `clinicalDesign.assessments` vs `soaAssessmentDefinitions` | Linkage exists but roles blur (WHAT vs SoA row presentation) |
| **CPL not in hierarchy** | Future CPL tab with no attachment model | Branching rules will be bolted onto visit×assessment cells |

### 3.3 What Stage 2 got right (preserve)

- **Structured before narrative** — sources drive `generateScheduleFromRules()`; matrix is cache.
- **Visit schedule as first-class** — anchors, windows, re-anchor/ripple policies.
- **SoA assessment catalog** — stable row identity decoupled from clinical design entity ids.
- **Assessment schedule rules** — explicit requiredness, timing, arm scope on intersections.
- **Validation and parity** — generated schedule must match rule-derived output.

The execution model evolution **extends** these strengths; it does not discard the generator pattern.

---

## 4. Recommended authoritative protocol execution model

### 4.1 Three-layer model (long-term)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER A — Clinical Design (WHAT)                                        │
│  objectives, endpoints, populations, arms, epochs, elements,             │
│  assessments (data definitions), relationships                           │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER B — Execution Schedule (WHEN / WHERE / HOW)                       │
│  arm-scoped pathways → epoch/element context → visit templates →         │
│  visit instances → activities (ordered, timed) → assessment placements │
│  schedule rules / CPL targets attach here                                │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER C — SoA Projection (VIEW)                                         │
│  document.schedule — Assessment × Visit matrix (per selected arm),       │
│  optional nested column headers, optional activity sub-rows in export      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Principle:** Layer B is authoritative for **execution**. Layer C is one **rendering** of Layer B for protocol tables and inspection—not the only rendering (timeline, site worksheet, USDM export may differ).

### 4.2 Recommended intersection model (answers the key question)

**Long-term authoritative intersection:**

> **Assessment × Activity** (activity instance scoped to a **Visit**), with implicit or explicit **Arm**, **Epoch**, and **Element** scope on the activity or visit template.

Formal shape (conceptual, not schema):

```
SchedulePlacement {
  armId?                    // required for multi-arm studies at authoring time
  visitDefinitionId         // which visit template / column family
  activityId                // operational activity within that visit
  assessmentId              // SoA catalog or clinical design assessment
  required, timing, windows, conditions, …
}
```

**Assessment × Visit** remains valid as a **derived projection**:

- Generator **rolls up** all activities at visit *V* where assessment *A* is placed → one cell `(V, A)` if any placement exists; required if any required; timing note aggregated or “see activities.”
- Authors who need simplicity can use a **“visit-level placement”** mode that creates a default activity bucket per visit (e.g. “General”)—still stored as activity-scoped for consistency.

| Criterion | Assessment × Visit (current) | Assessment × Activity (recommended) |
|-----------|------------------------------|-------------------------------------|
| Authoring fidelity | Low for multi-activity visits | High |
| USDM / OSB alignment | Weak | Strong |
| SoA table rendering | Native | Requires rollup projection |
| CPL expressiveness | Limited to visit/assessment | Can target activity start/stop, reorder |
| Migration cost | — | Phased; visit-only rules map to default activity |
| EDC site worksheet | Often activity-step based | Natural fit |

**Recommendation:** Adopt **Assessment × Activity** as the **source intersection** in Layer B. Keep **Assessment × Visit** as the **primary SoA matrix projection** for ICH-style tables, with optional **activity sub-row** or **grouped export** in later phases.

### 4.3 Arms and the generated matrix

- **Never** attempt to show all arms in one matrix without explicit comparison mode.
- **Arm selector** (global in SoA workspace) chooses `activeArmId` for:
  - Visit column set (arm-specific visit templates)
  - Activity templates
  - Schedule placements
  - Generated `document.schedule` slice (or filtered view)
- **Cross-arm diff** is a Change Control / amendment feature, not the default grid.

### 4.4 Nested column headers (source representation)

Protocol tables often use **multi-level headers**, e.g.:

```
Treatment
  Cycles 1–8
    Day 1 | Day 4 | Day 8/11
```

**Source model (conceptual):**

```
ColumnHeaderTree
  └── node: { kind: 'epoch' | 'cycleGroup' | 'visit' | 'label', label, children[] }
VisitDefinition
  └── columnHeaderPath: ref[]   // pointer into tree
  └── order, anchor, window, …
```

- **Epoch** nodes group visits without replacing visit identity.
- **Cycle groups** are either explicit entities or computed ranges over `visitDefinition.cycleNumber`.
- **Leaf** nodes bind to `visitDefinitionId` (SoA column).
- Generator flattens tree → `schedule.visits[]` with `headerPath` metadata for UI/export.

**Elements** do not usually become column headers; they contextualize **which visit templates exist** (e.g. only “Radiation weekly visits” during Radiation element).

---

## 5. Impact on SoA generation

### 5.1 Generator inputs (future)

| Input | Role |
|-------|------|
| `activeArmId` | Filter visit templates, activities, placements |
| Visit schedule | Anchors, windows, column order, header tree |
| Activity catalog per visit | Ordered activities with duration/offset |
| Assessment placements | Assessment × Activity (Layer B) |
| `soaAssessmentDefinitions` | Row labels, categories, narrative links |
| CPL resolved state (future) | Effective schedule after branching |

### 5.2 Generator outputs (unchanged role, richer metadata)

| Output | Notes |
|--------|-------|
| `schedule.visits` | Leaf columns; optional `headerPath`, `epoch`, `cycle` |
| `schedule.assessments` | Rolled-up rows from placements |
| `schedule.cells` | Rolled-up Assessment × Visit; optional `sourceActivityIds[]` in metadata |
| `schedule.metadata` | `activeArmId`, `generatedFromRules`, source counts per layer |

### 5.3 Rollup rules (Assessment × Activity → matrix cell)

For each `(visitDefinitionId, assessmentId)`:

1. Collect all placements across activities at that visit (for active arm).
2. **Present** if any placement exists.
3. **Required** if any placement is required (configurable: all vs any).
4. **Timing** — prefer most constraining window or list activity names in `timingNote`.
5. **Activity sub-rows** (optional view) — second matrix mode or expandable rows under assessment for power users.

### 5.4 Read-only guarantee

The generated SoA **remains read-only** in UI. Clicks on cells navigate to **placement** editor (activity + assessment), not direct cell mutation.

---

## 6. Impact on Conditional Protocol Logic (CPL)

### 6.1 CPL should attach to execution entities

CPL rules need a **target type** and **action** in the hierarchy:

| CPL action (examples) | Natural attachment level |
|----------------------|---------------------------|
| Stop / skip assessment | Assessment placement |
| Add / remove assessment | Activity or visit template |
| Stop / add activity | Activity (visit-scoped) |
| Create unscheduled visit | Visit schedule |
| Reorder activities | Activity order within visit |
| Transition element | Element assignment on subject pathway |
| Transition epoch | Epoch transition on schedule |
| Switch arm | Arm assignment |

**Recommendation:** CPL entries reference **`ExecutionTarget`** discriminated union:

```
ExecutionTarget =
  | { kind: 'assessmentPlacement', … }
  | { kind: 'activity', visitDefinitionId, activityId }
  | { kind: 'visit', visitDefinitionId }
  | { kind: 'element', elementId }
  | { kind: 'epoch', epochId }
  | { kind: 'arm', armId }
```

Conditions (e.g. tumor progression) evaluate against **clinical events** and **data assessments**, but **effects** apply at the **lowest level that matches operational intent**—usually activity or visit, not only matrix cells.

### 6.2 Interaction with current `assessmentScheduleRules`

- Short term: CPL may **override** or **disable** existing visit×assessment rules.
- Long term: CPL manipulates **placements**; generator produces rules + cells consistently.
- **Validation** must detect conflicts: CPL “remove activity” vs required assessment placement elsewhere.

### 6.3 Dependency graph

Graph nodes (objectives, endpoints, assessments) remain in **clinical design**. CPL links **execution targets** to **graph entities** for impact analysis (e.g. stopping assessment affects endpoint collection narrative).

---

## 7. Impact on narrative governance

Narrative sections (ICH M11 prose) should update from **structured change events** at the correct hierarchy level.

### 7.1 Impact propagation (conceptual)

| Change | Primary narrative targets | Secondary / propagated |
|--------|---------------------------|-------------------------|
| Assessment added/removed | Section 8 procedures, SoA table text, assessment list | Activity worksheet text, data management |
| Activity added/reordered | Visit workflow prose, nursing instructions | SoA footnotes, pharmacy manual |
| Visit added/changed | Schedule of assessments intro, visit window tables | Epoch/element descriptions, informed consent |
| Element changed | Treatment period descriptions, crossover rules | Visit templates, SoA column groups |
| Epoch changed | Study design section, schematic diagrams | Header groups, follow-up definitions |
| Arm changed | Treatment arms section, randomization | Entire arm-specific schedule chapters |

### 7.2 Governance workflow

1. **Classify** mutation by hierarchy level and `ExecutionTarget`.
2. **Resolve** linked `sectionId` / `linkedSectionId` from catalog and clinical design.
3. **Score impact** — assessment < activity < visit < element < epoch < arm (broader scope → more sections).
4. **Queue narrative tasks** — Stage 2e placeholder (“Narrative impact tracking coming soon”) evolves into per-level templates.
5. **Amendment diff** — show execution tree delta, not only matrix cell delta.

### 7.3 Copilot (future)

Copilot proposes changes at the **activity** or **visit** level; governance approves before placements persist—avoid prose-only SoA edits that bypass Layer B.

---

## 8. Impact on UI/UX (SoA Configuration workspace)

### 8.1 Re-evaluated workflow order

Current tab rail (post–Stage 2e UX refinement): Overview → Assessments → Visits → Schedule Rules → Generated SoA → Epochs → Activities → Elements → Arms → CPL → Change Control.

**Problem:** Arms and structure come **after** assessments and rules—inverse to execution hierarchy and arm-scoped authoring.

**Proposed workflow-oriented order:**

```
[ Overview ]
[ Arms ]              ← scope selector + arm definitions (first)
[ Epochs ]
[ Elements ]
[ Visits ]            ← visit templates, anchors, windows, column header tree
[ Activities ]        ← per-visit activity templates (ordered)
[ Assessments ]       ← catalog + link to clinical design; placements live under activities
[ Schedule ]          ← placements: assessment × activity (replaces “Schedule Rules” label)
[ Generated SoA ]     ← read-only matrix + arm selector (dedicated tab — keep)
[ Conditional Logic ]
[ Change Control ]
```

| Tab | Authoring focus |
|-----|-----------------|
| **Arms** | Define arms; **select active arm** for all other tabs |
| **Epochs** | Phase definitions; link to header groups |
| **Elements** | Treatment states; bind to visit template sets |
| **Visits** | When patient comes; anchor/window/policy |
| **Activities** | What happens at visit; order, duration, offsets |
| **Assessments** | What is measured; row catalog |
| **Schedule** | Where assessments fire (activity placements) |
| **Generated SoA** | Verify projection for **selected arm** |

### 8.2 Matrix placement

- **Dedicated Generated SoA tab** (implemented) — correct direction.
- Add **arm selector** in shell header (required before comparing schedules).
- Optional **view modes:** Matrix (visit×assessment rollup) | Activity timeline | Visit worksheet.
- Matrix should **not** occupy permanent bottom band when a full tab exists—maximizes authoring space.

### 8.3 Activities vs Assessments (UI relationship)

| Concept | UI home | User action |
|---------|---------|-------------|
| **Assessment catalog** | Assessments tab | Define row identity, category, narrative link |
| **Activity template** | Activities tab | Define visit-local workflow steps |
| **Placement** | Schedule tab (or inline under Activities) | Assign assessments to activities |
| **Clinical design assessment** | Activities / graph | Data definition, CDASH, performed-at |

Avoid duplicating “create assessment” in both Activities and Assessments without clear role copy: **Assessments tab = SoA row + data collection intent**; **Activities tab = site procedure**.

### 8.4 Elements vs Visits

- **Visits** answer *when* (calendar/anchor).
- **Elements** answer *in what treatment state* (may span visits).
- UI: Element editor shows **linked visit templates** and **allowed activity sets**; changing element offers “apply template pack to schedule.”

### 8.5 Inspector / Metadata panel

Continue showing **selected assessment** detail in right **Metadata** panel; extend to **selected activity** and **selected visit** when those tabs are active—same inspector pattern, context-aware.

### 8.6 Drag-and-drop ordering

- **Assessments tab:** row order (catalog `order`) — placeholder already acceptable.
- **Activities tab:** intra-visit activity order (execution-critical).
- **Visits tab:** column order / header tree (future).

---

## 9. Migration strategy from current implementation

Phased migration preserves Stage 2 parity and seed protocol behavior.

### Phase 0 — Architecture adoption (now)

- Publish this document; align stakeholders on Layer A/B/C and Assessment × Activity source model.
- **No** schema or plan file changes until approved.

### Phase 1 — UI and vocabulary (low risk)

- Rename tabs and copy to match hierarchy (Arms first, “Schedule” vs “Rules”).
- Arm selector UI with **single-arm projection** (filter existing rules/visits by `armRestrictions` where present).
- Hide internal ids (done); improve activity vs assessment labeling in UI.

### Phase 2 — Visit–activity catalog (domain extension)

- Introduce `visitActivityDefinitions[]` (or equivalent) under `visitSchedule` or sibling collection:
  - `visitDefinitionId`, `activityLabel`, `order`, `offsetMinutes`, `durationMinutes`, optional `clinicalDesignAssessmentIds[]`.
- Seed: default one implicit activity per visit mapping 1:1 from current rules.

### Phase 3 — Placement migration

- Add `activityId` (optional) to schedule intersections.
- Generator: if `activityId` absent, use default activity for visit; rollup unchanged.
- Authors gain activity-scoped editor; visit×assessment rules still valid.

### Phase 4 — Column header tree

- `columnHeaderTree` on visit schedule; generator emits flat visits with paths.
- UI renders grouped headers in Generated SoA tab.

### Phase 5 — CPL and narrative governance

- `ExecutionTarget` model; CPL authoring tab writes to placements/activities.
- Narrative impact engine uses hierarchy classification.

### Phase 6 — USDM / export profiles

- Export Layer B + projection metadata; map activities to USDM activity/Observation patterns.

**Backward compatibility rule:** Until Phase 3 completes, `assessmentScheduleRules` with only `visitDefinitionId` remain fully supported; parity tests must not regress.

---

## 10. Risks and benefits

### 10.1 Benefits

| Benefit | Description |
|---------|-------------|
| **Operational fidelity** | Schedules match site worksheets and EDC visit activities |
| **Standards path** | Cleaner USDM/OSB export and library reuse |
| **Arm safety** | Eliminates accidental mixed-arm SoA display |
| **CPL readiness** | Branching actions attach to meaningful targets |
| **Narrative precision** | Governance scopes impact to correct protocol sections |
| **Author clarity** | Workflow order matches how sponsors write protocols |

### 10.2 Risks

| Risk | Mitigation |
|------|------------|
| **Complexity for simple studies** | Default activity per visit; progressive disclosure |
| **Migration churn** | Phased optional fields; rollup preserves matrix |
| **Dual assessment concepts** | Clear naming: clinical design “Assessment entity” vs SoA catalog row |
| **Generator bugs** | Extend parity fixtures per phase; arm-scoped golden files |
| **UI overwhelm** | Arm-scoped tabs; Overview dashboard; matrix stays one tab |
| **Scope creep** | This document does not amend Stage 2 plan until sign-off |

---

## 11. Recommendation (summary)

1. **Adopt the six-level execution hierarchy** (Arm → Epoch → Element → Visit → Activity → Assessment) as the mental and long-term structural model for Layer B.
2. **Keep the generated SoA matrix** as a **read-only Layer C projection**, primarily **Assessment × Visit**, with an **arm selector** and optional nested epoch/cycle column headers.
3. **Evolve authoritative schedule intersections** from **Assessment × Visit** to **Assessment × Activity** (activity scoped to visit, arm, and element context), with generator **rollup** to current matrix shape during migration.
4. **Re-order SoA Configuration tabs** to workflow: **Arms → Epochs → Elements → Visits → Activities → Assessments → Schedule → Generated SoA → CPL → Change Control**.
5. **Model CPL and narrative governance** against **ExecutionTarget** types at the appropriate hierarchy level—not only matrix cells.
6. **Execute migration in six phases** without breaking Stage 2d parity or current `assessmentScheduleRules` consumers.

**Strategic alignment:** M11 Studio should remain **matrix-friendly** for protocol writers while becoming **execution-accurate** for sites, EDC, and standards. The SoA table is the **poster**; the **protocol execution model** is the **playbook**.

---

## Appendix A — Current vs target (quick reference)

| Aspect | Current (Stage 2e) | Target (execution model) |
|--------|-------------------|---------------------------|
| Primary intersection | `assessmentId` × `visitDefinitionId` | `assessmentId` × `activityId` @ visit (+ arm scope) |
| Matrix axes | Assessment × Visit | Assessment × Visit (rollup per arm) |
| Arm | Restrictions on rules/visits | Global arm selector + arm-scoped templates |
| Activity | Clinical design graph only | Visit-scoped activity templates |
| Column headers | Flat / `displayLabel` | `ColumnHeaderTree` + epoch/cycle groups |
| CPL | Future tab | `ExecutionTarget` on hierarchy |
| UI tab order | Assessments-first | Arms-first, structure-before-intersections |

---

## Appendix B — Related documents

| Document | Relationship |
|----------|--------------|
| [STAGE_2_IMPLEMENTATION_PLAN.md](./STAGE_2_IMPLEMENTATION_PLAN.md) | Current engineering baseline; unchanged by this doc |
| [SOA_CONFIGURATION_UI_ARCHITECTURE.md](./SOA_CONFIGURATION_UI_ARCHITECTURE.md) | UI shell and matrix foundation; to converge after adoption |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Application architecture |
| [ARCHITECTURE_VISION.md](./ARCHITECTURE_VISION.md) | Product vision |
| [OpenStudyBuilder](https://www.openstudybuilder.com/) | Activity-centric reference |

---

**Document version:** 1.0  
**Last updated:** 2026-06-04
