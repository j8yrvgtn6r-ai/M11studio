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
| 5 | **Clinical design owns WHAT; schedule owns WHEN/WHERE** | Arms, epochs, activities, elements link to visit/assessment configuration; SoA catalog projects rows/columns. |
| 6 | **Governance by default** | Configuration changes trigger validation, narrative impact analysis, and audit events before (or alongside) commit. |
| 7 | **Amendment-aware** | All edits occur in a protocol version context; comparison and change control are built in. |
| 8 | **OpenStudyBuilder-aligned semantics** | Study structure → visits → activities → schedule matrix mirrors industry MDR/EDC configuration patterns. |

---

## 3. Domain layering (what users edit vs what they see)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PROTOCOL EXPLORER — Section 1.3 "Schedule of Activities"               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  SoA Configuration Workspace (editable source layers)              │  │
│  │  Arms │ Epochs │ Visits │ Activities │ Elements │ Assessments │   │  │
│  │  Rules │ Conditional Logic (future) │ Validation │ Narrative Impact│  │
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

Primary tabs map 1:1 to user-facing configuration domains:

```
[ Overview ]  [ Arms ]  [ Epochs ]  [ Visits ]  [ Activities ]  [ Elements ]
[ SoA Assessments ]  [ Schedule Rules ]  [ Conditional Logic ★ ]  [ Change Control ]
```

★ **Conditional Protocol Logic** — visible from Phase 3 onward; read-only explainer + backlog in Phase 1–2.

**Overview** tab: study-level summary, validation dashboard, narrative impact queue, generation health (`sourceHash`, stale cache warnings).

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

### 7.1 Tab: Study Arms

**Purpose:** Define treatment and control arms that constrain schedule rules and conditional pathways.

| Workflow | Steps | Validation | Narrative impact |
|----------|-------|------------|----------------|
| Add arm | Arms list → Create → fill id, name, type → Save | Unique id; graph integrity | Sections describing randomization / treatment arms |
| Link arm to rules | Rule editor → armRestrictions multi-select | Rules reference valid arm ids | SoA footnotes, Section 6 arm descriptions |
| Delete arm | Confirm → check rules/CPL references | Block if referenced | Flag affected narrative |

**Inspector panels:** linked rules count, conditional pathways (future), section refs.

### 7.2 Tab: Study Epochs

**Purpose:** Define screening / treatment / follow-up periods that organize visits.

| Workflow | Steps |
|----------|-------|
| Define epoch sequence | Create epochs → set previous/next → assign visit definitions |
| Map to study elements | Cross-link element records to epoch ids |
| Validate continuity | Ensure no orphan epochs; visits reference valid epoch |

### 7.3 Tab: Study Visit Definitions

**Purpose:** Authoritative **WHEN** layer—anchors, nominal timing, windows, re-anchoring.

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

### 7.4 Tab: Study Activities

**Purpose:** Clinical **WHAT**—activities performed in the study (graph entities).

| Workflow | Steps |
|----------|-------|
| Define activity | Activities list → create assessment entity in clinical design |
| Link to SoA row | Prompt to create/update matching `soaAssessmentDefinitions` catalog entry |
| performed-at relationships | Graph or inline relationship editor to visits (validated vs rules) |

### 7.5 Tab: Study Elements

**Purpose:** Design periods / elements (e.g., Screening, Treatment, Follow-up) aligned with USDM StudyElement constructs.

| Workflow | Steps |
|----------|-------|
| Map elements to epochs | Element editor ↔ epoch linkage |
| Narrative binding | `sectionRef` on elements for governance |

### 7.6 Tab: SoA Assessment Definitions

**Purpose:** **Row catalog** for the generated matrix—presentation and stable rule targets (`a1`–`aN`).

| Workflow | Steps |
|----------|-------|
| Add SoA row | Catalog list → label, category, order |
| Link clinical assessment | Set `clinicalDesignAssessmentId` |
| Link narrative section | Set `linkedSectionId` / legacy refs |
| Reorder rows | Drag order → updates `order` field → regen cache |

**Constraint:** Rules must reference catalog ids only (enforced in domain).

### 7.7 Tab: Assessment Schedule Rules

**Purpose:** **Intersection authoring**—the primary scheduling workflow.

| Workflow | Steps |
|----------|-------|
| Add intersection | Rules list OR grid cell click → create rule (assessmentId + visitDefinitionId) |
| Toggle required | Rule editor `required` field (not grid cell toggle) |
| Set timing note | `timingNote` → flows to generated cell `notes` |
| Override windows | Rule-level `windowBeforeDays` / `windowAfterDays` |
| Arm scope | `armRestrictions[]` |
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

### 7.8 Tab: Conditional Protocol Logic (future — first-class from Phase 3)

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

### Phase 0 — Foundation (complete: Stage 2d)

- Generated SoA authoritative; auto-regen; parity; export freshness.
- Read-only grid with cache badge.

### Phase 1 — Minimal configuration UI (Stage 2e)

| Deliverable | Screens |
|-------------|---------|
| SoA Configuration shell + tab rail | `SOA-SHELL`, `SOA-OVERVIEW` |
| Visit Definitions CRUD UI | `SOA-VISITS-LIST`, `SOA-VISITS-EDIT` |
| Schedule Anchors CRUD UI | `SOA-ANCHORS-LIST`, `SOA-ANCHORS-EDIT` |
| Assessment Schedule Rules CRUD | `SOA-RULES-LIST`, `SOA-RULES-EDIT` |
| Grid click-through to rule editor | `SOA-GRID` |
| Live validation in inspector | `SOA-VALIDATION` (basic) |
| Conditional Logic tab placeholder | `SOA-CPL-OVERVIEW` (read-only) |

**Exit:** User adds/removes rule; grid updates via store regen; no direct cell editing.

### Phase 2 — Catalog, arms, epochs, governance scaffolding (Stage 2f + 3a)

| Deliverable | Screens |
|-------------|---------|
| SoA Assessment Definitions editor | `SOA-CATALOG-*` |
| Study Arms / Epochs / Activities lists | `SOA-ARMS-*`, `SOA-EPOCHS-*`, `SOA-ACTIVITIES-*` |
| Narrative impact queue (flag-only) | `SOA-NARRATIVE-IMPACT` |
| `validateScheduleConsistency` UI | Overview dashboard |
| Audit trail on mutations | `SOA-AUDIT` (read from store) |

### Phase 3 — Conditional logic, deviations, comparison (Stage 3+)

| Deliverable | Screens |
|-------------|---------|
| Conditional Protocol Logic tab (authoring) | `SOA-CPL-*` |
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
2. Every configuration area (arms through conditional logic) has a dedicated tab and editor.
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

*Document version: 1.0 — Stage 2d authoritative SoA checkpoint follow-on*
