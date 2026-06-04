# SoA Configuration UI/UX Architecture

**Status:** Architecture (no implementation)  
**Scope:** Authoring experience for Schedule of Activities configuration in M11 Studio  
**Authority:** Aligns with [STAGE_2_IMPLEMENTATION_PLAN.md](./STAGE_2_IMPLEMENTATION_PLAN.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and the Stage 2d generated SoA domain model  
**Reference model:** [OpenStudyBuilder](https://www.openstudybuilder.com/) / [openstudybuilder-solution](https://github.com/NovoNordisk-OpenSource/openstudybuilder-solution)

---

## 1. Purpose

This document defines the **complete authoring experience** for the SoA Configuration UI/UX—the structured study-design workspace currently represented under **Section 1.3 Schedule of Activities** in the Protocol Explorer.

The SoA Configuration experience must:

- Treat the **generated SoA matrix as read-only**—a derived view, not a spreadsheet.
- Route all user edits through **source layers** that drive `generateScheduleFromRules()`.
- Support **EDC-style protocol configuration** (anchors, windows, re-anchoring, visit policies, assessment timing).
- Integrate **narrative update governance**, **versioning/amendments**, and **audit/approval** as first-class workflows.
- Reserve **Conditional Protocol Logic** as a dedicated future tab and domain extension.
- Enable future **Copilot** assistance within governance guardrails.

**Non-goal:** Reintroducing direct cell editing on the generated grid as the primary authoring path.

---

## 2. Core design principles

| # | Principle | Implication for UI |
|---|-----------|------------------|
| 1 | **Structured sources are authoritative** | Users edit `clinicalDesign`, `visitSchedule`, `soaAssessmentDefinitions`, `assessmentScheduleRules`, and (future) conditional logic—not `document.schedule.cells`. |
| 2 | **Generated SoA is a cache/view** | Grid displays `document.schedule` after auto-regeneration; no toggle implying two competing truths. |
| 3 | **Write-through, never write-around** | Any grid interaction (click, toggle required, add intersection) opens or focuses the underlying **Assessment Schedule Rule** or catalog row. |
| 4 | **One intersection source** | Assessment × visit presence, requiredness, timing notes, and arm restrictions live on rules. |
| 5 | **Matrix foundation before branching** | Authors define **SoA assessment rows (Y)** and **visit columns (X)** before **schedule rules (cells)**; arms, epochs, activities, and conditional logic refine structure afterward. |
| 6 | **Clinical design owns WHAT; schedule owns WHEN/WHERE** | Epochs, activities, elements, and arms organize and link to the matrix; they do not replace catalog rows, visit definitions, or rules as intersection sources. |
| 7 | **Governance by default** | Configuration changes trigger validation, narrative impact analysis, and audit events before (or alongside) commit. |
| 8 | **Amendment-aware** | All edits occur in a protocol version context; comparison and change control are built in. |
| 9 | **OpenStudyBuilder-aligned semantics** | Activity-centric scheduling built on assessment rows + visit columns + rule intersections; study structure refines grouping and branching after the matrix foundation exists. |

---

## 2.1 Matrix foundation and product workflow

The generated SoA matrix is fundamentally **Assessment × Visit**:

```
                    Visit 1    Visit 2    Visit 3   …  (X axis)
                  ┌─────────┬─────────┬─────────┐
Assessment A (Y)  │  rule   │  rule   │         │
Assessment B      │  rule   │         │  rule   │
Assessment C      │         │  rule   │  rule   │
                  └─────────┴─────────┴─────────┘
                         ↑
              assessmentScheduleRules[]
              (required, timing, arm scope, …)
```

| Matrix layer | Domain source | Axis / role |
|--------------|---------------|-------------|
| **SoA Assessment Definitions** | `soaAssessmentDefinitions[]` | **Y axis** — row catalog (label, category, order, narrative links) |
| **Study Visit Definitions** | `visitSchedule.visitDefinitions[]` + `visitSchedule.anchors[]` | **X axis** — column catalog (timing, windows, re-anchor/ripple policies, display metadata) |
| **Assessment Schedule Rules** | `assessmentScheduleRules[]` | **Cells** — whether/how an assessment occurs at a visit |
| **Study Epochs & Study Activities** | `clinicalDesign` epochs/activities + relationships | **Grouping & organization** — epoch assignment, performed-at links, narrative structure after rows/columns exist |
| **Study Arms** | `clinicalDesign.studyArms[]` | **Branching scope** — arm restrictions on rules; prerequisite for arm-specific and conditional behavior (arms are not a visible matrix axis) |
| **Conditional Protocol Logic** | future `conditionalProtocolLogic[]` | **Pathway branching** — e.g. switch arms on treatment failure; depends on assessments, visits, arms, and rules |

**Authoring logic:**

1. Define **what appears as SoA rows** (`soaAssessmentDefinitions`) before schedule intersections are meaningful.
2. Define **when visits occur** (`visitSchedule`) after assessment rows exist, but **before** rule authoring—authors need both axes to reason about the matrix.
3. Author **rules** only once both axes exist—a rule is always `(assessmentId, visitDefinitionId)`.
4. Refine **epochs, activities, and elements** to organize visits and link clinical design to narrative sections.
5. Define **arms** before arm-scoped rules and conditional logic—logic such as *“if treatment fails, switch to Study Arm 2”* cannot be authored without arms.
6. Add **conditional protocol logic** last among configuration tabs—it consumes the foundational matrix plus arms.

**UI implication:** Tab rail order and Stage 2e delivery sequence follow this workflow (see §5.3–5.4, §16). The read-only generated grid remains visible throughout as the derived preview.

---

## 3. Domain layering (what users edit vs what they see)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PROTOCOL EXPLORER — Section 1.3 "Schedule of Activities"               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  SoA Configuration Workspace (editable source layers)              │  │
│  │  Assessments → Visits → Rules → Epochs/Activities/Elements → Arms │  │
│  │  → Conditional Logic (future) │ Validation │ Narrative Impact      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Generated SoA Matrix (read-only)                                  │  │
│  │  visits × assessments × cells ← document.schedule (auto-regen)     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

Source layers (editable):
  clinicalDesign.*          — arms, epochs, visits (WHAT), assessments, elements, relationships
  visitSchedule.*           — anchors, visitDefinitions, windows, re-anchor/ripple policies
  soaAssessmentDefinitions[] — SoA row catalog (presentation + links)
  assessmentScheduleRules[] — intersections, timing, arm restrictions, deviation policies
  conditionalProtocolLogic[] — future ProtocolDecisionRule / ConditionalPathwayRule

Derived view (read-only):
  document.schedule         — generated cache + metadata (sourceHash, generatedAt, …)
```

**Current implementation baseline (Stage 2d complete):** Generated SoA is authoritative in selectors and export; cache auto-regenerates on visit/rule/anchor mutations; parity and validation guard structural equivalence.

---

## 4. Reference model: OpenStudyBuilder

OpenStudyBuilder ([site](https://www.openstudybuilder.com/), [repo](https://github.com/NovoNordisk-OpenSource/openstudybuilder-solution)) provides a proven pattern for **metadata-driven study specification**:

| OSB concept | M11 Studio mapping | SoA Configuration UI area |
|-------------|-------------------|---------------------------|
| Study design / arms | `clinicalDesign.arms` | **Study Arms** tab |
| Study epochs / study elements | `clinicalDesign.epochs`, elements | **Study Epochs**, **Study Elements** |
| Visit schedule | `visitSchedule` | **Study Visit Definitions** tab |
| Activity / assessment concepts | `clinicalDesign.assessments`, `soaAssessmentDefinitions` | **Study Activities**, **SoA Assessment Definitions** |
| Activity schedule / SoA | `assessmentScheduleRules` + generated `schedule` | **Assessment Schedule Rules** tab + read-only grid |
| EDC strategies | Anchor/window/re-anchor policies | Embedded in visit + rule editors |
| Versioning & audit trail | Protocol versioning + `auditEvents` (future persistence) | **Change Control** panel |
| Library vs Study | Standards library (future) vs protocol document | Phase 4+ library integration |

**Adopt from OSB:** hierarchical study structure authoring, activity-centric scheduling, visit naming/timing/windows as first-class fields, downstream consistency from a single study definition repository, and amendment/version comparison workflows.

**Adapt for M11:** tighter coupling to **ICH M11 protocol narrative** (sections/elements), **Narrative Update Governance**, and **Protocol Copilot**; JSON `ProtocolDocument` store instead of Neo4j MDR in near term.

---

## 5. Navigation model

### 5.1 Entry points

| Entry | Behavior |
|-------|----------|
| Protocol Explorer → **Section 1.3** | Opens SoA Configuration workspace (replaces current static demo tabs) |
| Command palette → "Configure schedule…" | Jump to SoA workspace with focus search |
| Validation issue → schedule rule | Deep-link to rule editor + narrative section |
| Dependency graph → visit/assessment node | Cross-navigate to Visit Definitions or SoA Assessment Definitions |
| Amendment compare → schedule delta | Open change-control view filtered to schedule sources |

### 5.2 Workspace layout (three-pane IDE pattern)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ SoA Configuration — PROTO-XYZ-301  │ Version: v1.2-draft │ Status: Draft │
├──────────────┬───────────────────────────────────────┬───────────────────┤
│ CONFIG TABS  │  PRIMARY EDITOR (list / form / graph) │  INSPECTOR        │
│ (left rail)  │                                       │  • Metadata       │
│              │                                       │  • Validation     │
│              │                                       │  • Narrative links│
│              │                                       │  • Audit trail    │
│              │                                       │  • Approvals      │
├──────────────┴───────────────────────────────────────┴───────────────────┤
│ GENERATED SOA (read-only) — sticky preview band or split pane below        │
│ [ optional: live debug diff vs cache — dev only ]                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Tab rail (configuration areas)

Primary tabs map 1:1 to user-facing configuration domains. **Tab order follows the matrix foundation workflow** (§2.1)—not alphabetical or clinical-design hierarchy:

```
[ Overview ]
[ SoA Assessments ]  [ Visits ]  [ Schedule Rules ]
[ Epochs ]  [ Activities ]  [ Elements ]
[ Arms ]
[ Conditional Logic ★ ]  [ Change Control ]
```

| Tab group | Workflow step | Matrix role |
|-----------|---------------|-------------|
| **SoA Assessments** | 1 | Y axis — row catalog |
| **Visits** | 2 | X axis — visit definitions + anchors |
| **Schedule Rules** | 3 | Cell intersections |
| **Epochs / Activities / Elements** | 4 | Grouping, clinical design linkage, narrative refs |
| **Arms** | 5 | Arm scope for rules; prerequisite for branching |
| **Conditional Logic ★** | 6 | Pathway rules (future authoring) |

★ **Conditional Protocol Logic** — visible from Phase 1 onward as a planned tab; read-only explainer + backlog until Phase 3 authoring.

**Overview** tab: study-level summary, validation dashboard, narrative impact queue, generation health (`sourceHash`, stale cache warnings).

**Note (implementation):** The shell tab rail will be reordered to match this sequence during Stage 2e. Early PRs may ship tabs out of rail order (e.g. Visits read-only before Assessments editor)—domain and docs treat **Assessments → Visits → Rules** as the canonical product sequence.

### 5.4 Recommended authoring workflow order

When guiding authors or sequencing in-app empty states, onboarding, and “next step” prompts:

| Step | Tab | Author action | Depends on |
|------|-----|---------------|------------|
| 1 | SoA Assessments | Add/reorder SoA row catalog entries; link clinical assessments and narrative sections | — |
| 2 | Visits | Define anchors and visit definitions; set windows and re-anchor policies | Assessment rows exist (for cross-reference in help text; not a hard domain dependency) |
| 3 | Schedule Rules | Create `(assessment, visit)` rules; set required, timing, arm restrictions | Both catalog rows and visit definitions |
| 4 | Epochs / Activities / Elements | Assign epochs to visits; link activities; map study elements | Matrix foundation in place |
| 5 | Arms | Define study arms; scope rules by arm | Rules catalog useful for arm-restricted authoring |
| 6 | Conditional Logic | Define decision rules and pathway impacts (future) | Arms + matrix + rules |

**Grid preview:** The generated SoA matrix at the bottom of the workspace updates after rule and source mutations regardless of which tab is active—it always reflects the current **Assessment × Visit** cache.

---

## 6. Screen inventory

### 6.1 Overview & shell

| Screen ID | Name | Purpose |
|-----------|------|---------|
| `SOA-SHELL` | SoA Configuration Shell | Tab rail, version context, global actions (Validate, Preview narrative impact, Export) |
| `SOA-OVERVIEW` | Configuration Overview | Counts, stale-cache status, open validation issues, pending narrative proposals |
| `SOA-GRID` | Generated SoA Matrix | Read-only interactive grid; cell click → rule inspector |

### 6.2 Study design (clinical design graph projections)

| Screen ID | Name | Edits | Domain |
|-----------|------|-------|--------|
| `SOA-ARMS-LIST` | Study Arms List | CRUD arms, randomization refs | `clinicalDesign.arms` |
| `SOA-ARMS-EDIT` | Study Arm Editor | Name, type, description, section refs | `clinicalDesign.arms` |
| `SOA-EPOCHS-LIST` | Study Epochs List | CRUD epochs, sequencing | `clinicalDesign.epochs` |
| `SOA-EPOCHS-EDIT` | Study Epoch Editor | Type, previous/next links, epoch windows | `clinicalDesign.epochs` |
| `SOA-ACTIVITIES-LIST` | Study Activities List | CRUD clinical assessments/activities | `clinicalDesign.assessments` |
| `SOA-ACTIVITIES-EDIT` | Study Activity Editor | Label, category, performed-at relationships | `clinicalDesign.assessments` + `relationships` |
| `SOA-ELEMENTS-LIST` | Study Elements List | CRUD study elements (design periods) | `clinicalDesign` element collections |
| `SOA-ELEMENTS-EDIT` | Study Element Editor | Labels, descriptions, epoch mapping | `clinicalDesign` elements |

### 6.3 Visit schedule

| Screen ID | Name | Edits | Domain |
|-----------|------|-------|--------|
| `SOA-ANCHORS-LIST` | Schedule Anchors Catalog | CRUD anchor events | `visitSchedule.anchors` |
| `SOA-ANCHORS-EDIT` | Schedule Anchor Editor | anchorType, sourceVisitId, descriptions | `visitSchedule.anchors` |
| `SOA-VISITS-LIST` | Visit Definitions List | CRUD visits, ordering, epoch assignment | `visitSchedule.visitDefinitions` |
| `SOA-VISITS-EDIT` | Visit Definition Editor | Anchor, offsets, windows, policies, display metadata | `visitSchedule.visitDefinitions` |
| `SOA-VISITS-TIMELINE` | Visit Timeline Preview | Read-only nominal timeline from anchors + offsets | derived preview |
| `SOA-UNSCHEDULED` | Unscheduled Visits Policy | Define unscheduled visit types and handling | future `UnscheduledVisitDefinition` |
| `SOA-MISSED-VISIT` | Missed Visit Policies | Per-visit missedVisitPolicy templates | `visitDefinition.missedVisitPolicy` |

### 6.4 SoA catalog & rules

| Screen ID | Name | Edits | Domain |
|-----------|------|-------|--------|
| `SOA-CATALOG-LIST` | SoA Assessment Definitions | Row order, labels, categories, links | `soaAssessmentDefinitions[]` |
| `SOA-CATALOG-EDIT` | SoA Assessment Editor | clinicalDesignAssessmentId, linkedSectionId, display | `soaAssessmentDefinitions[]` |
| `SOA-RULES-LIST` | Assessment Schedule Rules | Matrix-style rule list / filter by visit or assessment | `assessmentScheduleRules[]` |
| `SOA-RULES-EDIT` | Rule Editor | required, timingNote, windows, armRestrictions, relativeTiming | `assessmentScheduleRules[]` |
| `SOA-RULES-BULK` | Bulk Rule Operations | Copy visit column, apply template, arm-scoped batch | `assessmentScheduleRules[]` |
| `SOA-RULES-ADVANCED` | Advanced Timing & Deviation | independentOfDoseDelay, re-anchor conflicts, deviation recording | rules + visit policies |

### 6.5 Conditional protocol logic (future)

| Screen ID | Name | Edits | Domain |
|-----------|------|-------|--------|
| `SOA-CPL-OVERVIEW` | Conditional Logic Overview | Pathway map, unreachable branch warnings | `conditionalProtocolLogic[]` |
| `SOA-CPL-LIST` | Decision Rules List | CRUD ProtocolDecisionRule | future collection |
| `SOA-CPL-EDIT` | Decision Rule Editor | trigger, condition, actionType, impacts | future collection |
| `SOA-CPL-GRAPH` | Pathway Visualization | Arm/visit/assessment graph with decision nodes | derived view |
| `SOA-CPL-SIMULATE` | Course Simulation (future) | Example patient trajectories | read-only simulator |

### 6.6 Governance, versioning, audit

| Screen ID | Name | Purpose |
|-----------|------|---------|
| `SOA-VALIDATION` | Schedule Validation Panel | Live `validateProtocol` + schedule consistency |
| `SOA-NARRATIVE-IMPACT` | Narrative Impact Queue | Affected sections, proposed language, approval state |
| `SOA-CHANGE-CONTROL` | Change Control | Amendment diff, compare versions, export change package |
| `SOA-AUDIT` | Audit Trail | Filterable event log for configuration mutations |
| `SOA-APPROVALS` | Approval Inbox | Pending approvals for config + narrative commits |

---

## 7. Tab structure & primary workflows

Tabs are documented below by **domain**. For **authoring sequence**, follow §2.1 and §5.4: **SoA Assessments → Visits → Schedule Rules → Epochs/Activities/Elements → Arms → Conditional Logic**.

### 7.1 Tab: SoA Assessment Definitions *(workflow step 1 — Y axis)*

**Purpose:** **Row catalog** for the generated matrix—presentation and stable rule targets (`a1`–`aN`). Define assessment/procedure rows before schedule intersections make sense.

| Workflow | Steps |
|----------|-------|
| Add SoA row | Catalog list → label, category, order |
| Link clinical assessment | Set `clinicalDesignAssessmentId` |
| Link narrative section | Set `linkedSectionId` / legacy refs |
| Reorder rows | Drag order → updates `order` field → regen cache |

**Constraint:** Rules must reference catalog ids only (enforced in domain).

### 7.2 Tab: Study Visit Definitions *(workflow step 2 — X axis)*

**Purpose:** Authoritative **WHEN** layer—anchors, nominal timing, windows, re-anchoring. Visits form matrix columns; configure after assessment rows are available, before schedule rules.

| Workflow | Steps | Key fields |
|----------|-------|------------|
| Create anchor catalog | Anchors list → define randomization, first-dose, cycle anchors | `anchorType`, `sourceVisitId` |
| Add visit definition | Visits list → pick anchor → set offsets → set windows | `offsetDays`, `windowBeforeDays`, `windowAfterDays` |
| Configure re-anchoring | Visit editor → policies section | `reanchorPolicy`, `ripplePolicy`, `preserveOriginalSchedule` |
| Display metadata | SoA column labels | `displayLabel`, `timepointDisplay`, `soaColumnId` |
| Link clinical visit | Optional `clinicalDesignVisitId` | cross-layer validation |

**EDC-style affordances:**

- **Nominal vs actual preview** — read-only band showing fixed vs rolling behavior (Example C hybrid).
- **Window calculator** — symmetric/asymmetric helper; shows narrative-ready string.
- **Anchor picker** — catalog + inline create; prevents invalid `sourceVisitId` loops.

**Unscheduled visits (Phase 3):** separate sub-panel for visit types allowed outside nominal schedule; links to deviation recording policy.

**Missed visits:** per-visit `missedVisitPolicy` enum (`recordDeviationOnly`, `rescheduleWithinWindow`, `excludeFromAnalysis`, etc.) with EDC-oriented help text.

### 7.3 Tab: Assessment Schedule Rules *(workflow step 3 — cells)*

**Purpose:** **Intersection authoring**—the primary scheduling workflow once both axes exist.

| Workflow | Steps |
|----------|-------|
| Add intersection | Rules list OR grid cell click → create rule (assessmentId + visitDefinitionId) |
| Toggle required | Rule editor `required` field (not grid cell toggle) |
| Set timing note | `timingNote` → flows to generated cell `notes` |
| Override windows | Rule-level `windowBeforeDays` / `windowAfterDays` |
| Arm scope | `armRestrictions[]` (meaningful after arms are defined) |
| Relative timing | `relativeTiming` enum (before/after administration, continuous, interval-weeks) |
| Dose-delay independence | `independentOfDoseDelay` (imaging/survival); surfaces `imaging_rolling_conflict` validation |
| Delete intersection | Delete rule → auto-regen cache |

**Advanced sub-workflows:**

| Topic | UI treatment |
|-------|--------------|
| **Visit windows** | Inherited from visit def with rule override indicators |
| **Unscheduled visits** | Flag on visit + deviation capture template (Phase 3) |
| **Missed visits** | Visit policy + narrative stub generation |
| **Anchor-visit behavior** | Anchor editor + visit anchor picker with live timepoint preview |
| **Re-anchoring** | Visit policy controls + conflict callouts when rules assume fixed schedule |
| **Ripple effects** | `ripplePolicy` with explanatory diagram |
| **Protocol deviation handling** | Link to deviation policy catalog; record-only vs reschedule vs discontinue pathways |

**Bulk operations (Phase 2):** copy all rules from visit A → visit B; apply assessment template to epoch.

### 7.4 Tab: Study Epochs *(workflow step 4a — grouping)*

**Purpose:** Define screening / treatment / follow-up periods that organize visits.

| Workflow | Steps |
|----------|-------|
| Define epoch sequence | Create epochs → set previous/next → assign visit definitions |
| Map to study elements | Cross-link element records to epoch ids |
| Validate continuity | Ensure no orphan epochs; visits reference valid epoch |

### 7.5 Tab: Study Activities *(workflow step 4b — clinical WHAT)*

**Purpose:** Clinical **WHAT**—activities performed in the study (graph entities).

| Workflow | Steps |
|----------|-------|
| Define activity | Activities list → create assessment entity in clinical design |
| Link to SoA row | Prompt to create/update matching `soaAssessmentDefinitions` catalog entry |
| performed-at relationships | Graph or inline relationship editor to visits (validated vs rules) |

### 7.6 Tab: Study Elements *(workflow step 4c — design periods)*

**Purpose:** Design periods / elements (e.g., Screening, Treatment, Follow-up) aligned with USDM StudyElement constructs.

| Workflow | Steps |
|----------|-------|
| Map elements to epochs | Element editor ↔ epoch linkage |
| Narrative binding | `sectionRef` on elements for governance |

### 7.7 Tab: Study Arms *(workflow step 5 — branching prerequisite)*

**Purpose:** Define treatment and control arms that constrain schedule rules and conditional pathways. Arms are not a visible matrix axis but are required before arm-specific rules and conditional logic (e.g. *switch to Study Arm 2 on treatment failure*).

| Workflow | Steps | Validation | Narrative impact |
|----------|-------|------------|----------------|
| Add arm | Arms list → Create → fill id, name, type → Save | Unique id; graph integrity | Sections describing randomization / treatment arms |
| Link arm to rules | Rule editor → armRestrictions multi-select | Rules reference valid arm ids | SoA footnotes, Section 6 arm descriptions |
| Delete arm | Confirm → check rules/CPL references | Block if referenced | Flag affected narrative |

**Inspector panels:** linked rules count, conditional pathways (future), section refs.

### 7.8 Tab: Conditional Protocol Logic (future — workflow step 6)

**Purpose:** Model **patient course variations** that change treatment, visits, assessments, arms, or protocol status.

| Workflow | Phase | Description |
|----------|-------|-------------|
| Placeholder tab | Phase 1–2 | Explains future capability; links to STAGE_2 §8.4 scenarios |
| Define decision rule | Phase 3 | Create `ProtocolDecisionRule` with trigger + condition + action |
| Visualize pathways | Phase 3 | Graph of arm/visit/assessment impacts |
| Validate logic | Phase 3 | Contradictory rules, unreachable branches, circular chains |
| Narrative binding | Phase 4 | `narrativeSectionIds[]` auto-populated; governance queue |

**Example scenarios (from domain plan):**

- Tumor progression → switch to surgery arm  
- Inadequate response → increase dose frequency  
- Toxicity threshold → dose reduction / delay  
- Progression → treatment failure / discontinuation  
- Missed visit → re-anchor vs preserve nominal schedule (may overlap visit policies or require outcome-triggered logic)

**Relationship to generator:** Conditional logic **does not** edit the grid directly; it mutates source layers (arms, visits, rules) or activates pathway state that future generators consume.

---

## 8. Generated SoA matrix (read-only) UX

### 8.1 Grid behavior

| Interaction | Result |
|-------------|--------|
| View grid | Read `document.schedule` via selectors; show cache metadata badge |
| Click cell | Open **Assessment Schedule Rule** editor for `(visitId, assessmentId)`; offer Create if no rule |
| Click row header | Navigate to **SoA Assessment Definition** |
| Click column header | Navigate to **Visit Definition** |
| Hover cell | Show timing note, arm restrictions, validation warnings |
| Export SoA | Export structured JSON/USDM slice via governed export—not CSV edit |

### 8.2 Explicit prohibitions

- No in-grid typing, paste, or spreadsheet fill-handle.
- No "Legacy vs Generated" dual-source toggle in production UI.
- No silent write to `document.schedule.cells` without rule mutation + regen.

### 8.3 Optional dev-only tools

- Live `generateScheduleFromRules()` diff vs cache (debug).
- Parity report panel (`reportGeneratedScheduleDiff`) for authors with admin role.

---

## 9. Validation workflows

### 9.1 Validation layers

```
┌─────────────────────────────────────────────────────────┐
│ L1  Field-level (inline)     — immediate on blur/save │
│ L2  Entity-level (on save)     — validateProtocol slice │
│ L3  Cross-layer (on save)      — rules ↔ catalog ↔ CD   │
│ L4  Schedule consistency       — validateScheduleConsistency │
│ L5  Narrative structural       — section/id cross-refs  │
│ L6  Conditional logic (future) — pathway integrity      │
└─────────────────────────────────────────────────────────┘
```

### 9.2 When validation runs

| Trigger | Validations |
|---------|-------------|
| Field blur | L1 inline (windows ≥ 0, ids non-empty) |
| Save entity | L2 + L3 |
| Save rule / visit | L2–L4 + schedule cache regen + stale check |
| Tab switch to Overview | Full L2–L4 summary |
| Pre-export | `ensureAuthoritativeScheduleCacheFresh()` + full validation |
| Pre-approval | Full validation + narrative impact queue empty or deferred with reason |
| Amendment publish | Compare validation against prior version |

### 9.3 User-facing validation UX

| Element | Behavior |
|---------|----------|
| Inline field error | Block save; show code + human message |
| Inspector validation tab | Grouped errors/warnings with deep links |
| Overview dashboard | Count by severity; filter by configuration area |
| Grid overlay | Icon on cells with rule/visit validation issues |
| Conflict resolution wizard | e.g. `imaging_rolling_conflict` — choose fix visit policy or rule flag |

### 9.4 Representative validation codes (existing + planned)

| Code | Area | UI surfacing |
|------|------|--------------|
| `schedule_cache_stale` | Cache | Overview banner; block export until regen |
| `imaging_rolling_conflict` | Rules + visits | Rule editor callout + suggested fixes |
| `invalid_visit_definition_anchor` | Visits | Visit editor inline |
| `assessment_schedule_rule_*` | Rules | Rule list badge |
| `SCHEDULE_NARRATIVE_WINDOW_MISMATCH` | Narrative | Narrative impact queue (Phase 2f+) |
| `CPL_CONTRADICTORY_RULE` | Conditional logic | CPL graph highlight (future) |

---

## 10. Narrative impact workflows

### 10.1 Governance principle

Structured configuration changes **automatically** trigger narrative impact analysis. The system **never silently ignores** inconsistencies between configuration and prose.

### 10.2 Impact detection map

| Source change | Detection hooks | Typical affected narrative |
|---------------|-------------------|----------------------------|
| Visit window / anchor | `visitDefinition` + section cross-refs | Section 1.3, schedule synopsis elements |
| Rule timing note | `timingNote`, `linkedSectionId` | Assessment procedure sections (e.g. 8.3, 8.4) |
| SoA catalog label/order | `soaAssessmentDefinitions` | SoA table intro, assessment lists |
| Arm restriction | `armRestrictions` | Section 6 treatment description |
| Conditional logic (future) | `narrativeSectionIds` on decision rules | Efficacy/discontinuation sections |

### 10.3 Narrative impact queue workflow

```
Configuration save
       │
       ▼
Detect affected sections/elements (linkedSectionId, sectionRef, cross-refs)
       │
       ▼
Generate proposed narrative updates (template + optional Copilot)
       │
       ▼
Present diff review UI ──► User edits proposal
       │
       ├── Approve ──► Commit element values + audit record
       ├── Reject ──► Log reason; keep inconsistency flagged
       └── Defer ──► Track as open validation issue
```

### 10.4 UI surfaces

| Surface | Function |
|---------|----------|
| `SOA-NARRATIVE-IMPACT` | Queue of pending proposals with severity |
| Split diff viewer | Side-by-side current prose vs proposed |
| Section jump | Open Document Viewport on affected section |
| Batch approve | Policy-gated multi-section commit (role-based) |

**Phase 1 (2f scaffolding):** detect + flag only—no auto-proposals.  
**Phase 2:** template-based proposals for windows and timing notes.  
**Phase 3+:** Copilot-generated proposals within approval workflow.

---

## 11. Versioning, amendments, and comparison

### 11.1 Version context model

Every SoA Configuration session operates within a **protocol version context**:

| Concept | UI representation |
|---------|-------------------|
| Working draft | Editable; auto-save to store |
| Submitted version | Read-only snapshot; triggers approval |
| Approved baseline | Tagged `metadata.lifecycleStatus` |
| Amendment branch | Fork from approved; amendment id in toolbar |

### 11.2 Amendment workflow

```
Approved v1.0
     │
     ▼
Create Amendment A-001 (branch)
     │
     ▼
Edit source layers in SoA Configuration
     │
     ▼
Change Control tab ──► structural diff vs v1.0
     │                  (visits, rules, catalog, arms)
     ▼
Validation + narrative impact resolution
     │
     ▼
Approval workflow ──► publish Amendment A-001 as v1.1
```

### 11.3 Comparison UX (`SOA-CHANGE-CONTROL`)

| Compare dimension | View |
|-------------------|------|
| Visit definitions | Side-by-side table: anchor, offsets, windows, policies |
| Rules | Added/removed/changed intersections matrix |
| SoA catalog | Row label/category/order diffs |
| Generated schedule | Diff of cache snapshots (structural + content) |
| Narrative | Element-level text diff for impacted sections |
| Conditional logic (future) | Decision rule graph diff |

**Export:** amendment package JSON (structured delta + audit trail + approved narrative commits)—aligned with OpenStudyBuilder export/import patterns.

---

## 12. Audit and approval workflows

### 12.1 Audit trail events

Record on every committed mutation (extends `auditEvents` shape):

| Event type | Payload |
|------------|---------|
| `schedule.source.created` | entity type, id, version |
| `schedule.source.updated` | field-level diff, user, timestamp |
| `schedule.source.deleted` | id, cascade impacts |
| `schedule.cache.regenerated` | sourceHash, rule/visit counts |
| `narrative.proposal.generated` | section ids, proposal id |
| `narrative.proposal.approved` | final text hash, approver |
| `narrative.proposal.rejected` | reason |
| `amendment.submitted` | amendment id, baseline version |
| `amendment.approved` | approver, effective date |

### 12.2 Approval workflow states

```
Draft ──► In Review ──► Approved
           │              │
           └── Rejected ──┘
```

| Gate | Requirements |
|------|--------------|
| Submit for review | Zero validation errors; warnings acknowledged |
| Approve configuration | Role: Medical Writer / Study Designer |
| Approve narrative batch | Separate gate; linked to impact queue |
| Publish amendment | Both configuration + narrative approvals (policy-configurable) |

### 12.3 UI surfaces

| Surface | Users |
|---------|-------|
| `SOA-AUDIT` | All roles—filter by entity, user, date |
| `SOA-APPROVALS` | Reviewers—pending items with diff preview |
| Inspector → Audit tab | Contextual history for selected entity |
| Status bar | Protocol version + approval state |

---

## 13. Future Copilot integration points

Copilot assists **within governance guardrails**—propose, never silently commit.

| Integration point | Copilot role | Guardrail |
|-------------------|--------------|-----------|
| Rule creation | Suggest intersections from protocol PDF import | User confirms each rule |
| Visit schedule | Propose anchor/window model from synopsis text | Diff against structured elements first |
| Timing notes | Draft `timingNote` from assessment procedure prose | Narrative impact queue approval |
| Validation fixes | Explain validation code + suggest fix | User applies fix explicitly |
| Conditional logic | Draft decision rules from eligibility/discontinuation sections | CPL validator must pass |
| Narrative updates | Generate section prose from structured config | Approval required before commit |
| Amendment summary | Auto-draft amendment synopsis | Medical writer edit + approve |
| Compare / impact | Natural language summary of version diff | Read-only |

**UX pattern:** Copilot panel docked in inspector (reuse Protocol Copilot shell) with **context scope** = active tab + selected entity.

---

## 14. EDC-style configuration patterns

| EDC concept | SoA Configuration UI expression |
|-------------|--------------------------------|
| Visit schedule of events | Visit Definitions + generated columns |
| Anchor events (randomization, first dose) | Schedule Anchors catalog |
| Visit windows | `windowBeforeDays` / `windowAfterDays` with preview strings |
| Unscheduled visits | Unscheduled visit policy panel (Phase 3) |
| Missed visit handling | `missedVisitPolicy` per visit |
| Re-anchor on actual dates | `reanchorPolicy` + rolling ripple preview |
| Activity schedule | Assessment Schedule Rules |
| Arm-specific schedules | `armRestrictions` on rules |
| Protocol deviations | Deviation policy linkage + audit (Phase 3) |
| SDE / USDM export | Governed export of structured layers + generated cache |

---

## 15. Relationship to current Section 1.3 UI

| Current (post Stage 2d PR 5) | Target SoA Configuration |
|------------------------------|--------------------------|
| Static Study Info / Epochs / Arms demo tables | Replaced by live clinical design + visit editors |
| Interactive grid (read-only, cache-backed) | Retained as bottom preview band |
| Generated cache badge | Retained; extended with stale warnings |
| No rule editing | Full Schedule Rules tab + cell click-through |
| No validation integration | Live validation in inspector + overview |

**Protocol Explorer node:** Section 1.3 retains `viewKind: 'schedule-of-activities'` but Document Viewport renders **SoA Configuration Shell** instead of static tabs.

---

## 16. Recommended implementation phases

**Stage 2e build sequence (product workflow):** Deliver tabs and editors in matrix-foundation order—**SoA Assessments → Visits → Schedule Rules → Epochs/Activities/Elements → Arms → Conditional Logic placeholder/authoring**—not clinical-design hierarchy order. See [STAGE_2_IMPLEMENTATION_PLAN.md](./STAGE_2_IMPLEMENTATION_PLAN.md) §12 for PR-level breakdown.

### Phase 0 — Foundation (complete: Stage 2d)

- Generated SoA authoritative; auto-regen; parity; export freshness.
- Read-only grid with cache badge.

### Phase 1 — Matrix foundation UI (Stage 2e)

| Order | Deliverable | Screens | Status |
|-------|-------------|---------|--------|
| 0 | SoA Configuration shell + tab rail + overview | `SOA-SHELL`, `SOA-OVERVIEW` | **Done** (`54668b8`) |
| 1 | **SoA Assessment Definitions** read-only list + detail | `SOA-CATALOG-LIST` (read-only) | Next |
| 1b | SoA Assessment Definitions CRUD | `SOA-CATALOG-LIST`, `SOA-CATALOG-EDIT` | Planned |
| 2 | **Study Visit Definitions** read-only list + detail | `SOA-VISITS-LIST` (read-only) | **Done** (`7d6287e`; shipped before step 1—rail reorder pending) |
| 2b | Visit Definitions + Schedule Anchors CRUD | `SOA-VISITS-*`, `SOA-ANCHORS-*` | Planned |
| 3 | **Assessment Schedule Rules** read-only matrix/list | `SOA-RULES-LIST` (read-only) | Planned |
| 3b | Assessment Schedule Rules CRUD | `SOA-RULES-LIST`, `SOA-RULES-EDIT` | Planned |
| — | Grid click-through to rule editor | `SOA-GRID` | Planned |
| — | Live validation in inspector | `SOA-VALIDATION` (basic) | Planned |
| — | Conditional Logic tab placeholder | `SOA-CPL-OVERVIEW` (read-only) | **Done** (shell placeholder) |

**Exit:** User defines assessment rows and visit columns, adds/removes rules, and sees the grid update via store regen—no direct cell editing.

### Phase 2 — Grouping, arms, governance scaffolding (Stage 2f + 3a)

| Order | Deliverable | Screens |
|-------|-------------|---------|
| 4 | Study Epochs / Activities / Elements lists (read-only → CRUD) | `SOA-EPOCHS-*`, `SOA-ACTIVITIES-*`, `SOA-ELEMENTS-*` |
| 5 | Study Arms list (read-only → CRUD) | `SOA-ARMS-*` |
| — | Narrative impact queue (flag-only) | `SOA-NARRATIVE-IMPACT` |
| — | `validateScheduleConsistency` UI | Overview dashboard |
| — | Audit trail on mutations | `SOA-AUDIT` (read from store) |

### Phase 3 — Conditional logic, deviations, comparison (Stage 3+)

| Deliverable | Screens |
|-------------|---------|
| **Conditional Protocol Logic tab (authoring)** — workflow step 6 | `SOA-CPL-*` |
| Unscheduled / missed visit policies | `SOA-UNSCHEDULED`, `SOA-MISSED-VISIT` |
| Change control / version compare | `SOA-CHANGE-CONTROL` |
| Amendment branch workflow | Shell version context |
| Bulk rule operations | `SOA-RULES-BULK` |

### Phase 4 — Approvals, Copilot, library integration

| Deliverable | Screens |
|-------------|---------|
| Approval inbox + gates | `SOA-APPROVALS` |
| Copilot proposals in narrative queue | Inspector Copilot scope |
| Narrative auto-proposals with approve/reject | `SOA-NARRATIVE-IMPACT` full |
| Standards library linkage (OSB-style) | External library picker |
| USDM / DDF export profiles | Export wizard |

### Phase 5 — Simulation & advanced EDC parity

| Deliverable | Description |
|-------------|-------------|
| Nominal vs rolling simulation | Example C hybrid preview |
| Patient course simulator | Conditional logic paths |
| Full protocol deviation workflow | EDC handoff metadata |

---

## 17. Dependencies and constraints

| Dependency | Notes |
|------------|-------|
| Protocol Store mutations | All UI writes via existing store modules; extend with SoA catalog CRUD |
| `subscribe()` | Grid preview refreshes on cache regen |
| Parity / validation scripts | CI gates for UI phases |
| Narrative Update Governance platform | Phase 2f scaffolding → Stage 4 full platform |
| Conditional Protocol Logic domain | Must precede CPL tab authoring |
| Role-based access control | Future; design audit/approval screens with roles in mind |

**Out of scope for this architecture document:** API design, persistence backend, Neo4j/graph DB, Word add-in, full USDM schema mapping.

---

## 18. Success criteria

The SoA Configuration UI is successful when:

1. Authors never need to edit the generated grid directly to change the SoA.
2. Every configuration area follows the **matrix foundation workflow** (assessments → visits → rules → grouping → arms → conditional logic) with a dedicated tab and editor.
3. Validation and narrative impact are visible before publish—not discovered at export.
4. Amendments can be compared structurally and narratively with audit traceability.
5. The experience is recognizable to users of OpenStudyBuilder-style study design tools while respecting M11 narrative governance.
6. Conditional Protocol Logic is visible as a first-class future tab from Phase 1 onward.
7. Copilot accelerates authoring without bypassing approval workflows.

---

## 19. Related documents

| Document | Relevance |
|----------|-----------|
| [STAGE_2_IMPLEMENTATION_PLAN.md](./STAGE_2_IMPLEMENTATION_PLAN.md) | Domain model, §8 SoA Configuration, §8.4 Conditional Logic, §10.3 Narrative Governance |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | App shell, Protocol Explorer, store/selectors |
| [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md) | Stage 3 SoA Configuration Tool, Stage 4 Validation Platform |
| [OpenStudyBuilder Guides](https://www.openstudybuilder.com/) | Study Structure, Visits, Activity Concept, EDC Strategies |
| [openstudybuilder-solution](https://github.com/NovoNordisk-OpenSource/openstudybuilder-solution) | Reference implementation patterns |

---

*Document version: 1.1 — Stage 2e workflow reorder (Assessment × Visit foundation)*
