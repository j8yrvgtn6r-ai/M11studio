# STAGE_1_IMPLEMENTATION_PLAN.md

# Akyrian M11 Studio — Stage 1 Implementation Plan

**Stage:** 1 — Protocol Engineering Environment  
**Focus:** Clinical Design Model & first-class clinical design entities  
**Status:** Planned  
**Baseline:** `v0.1.0-stage0` (Stage 0 complete, 2026-06-03)  
**Last updated:** 2026-06-03

---

## Authority Documents

Read before implementing any Stage 1 task:

1. [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)  
2. [ARCHITECTURE_VISION.md](./ARCHITECTURE_VISION.md)  
3. [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)  
4. [STAGE_0_CLOSURE_REPORT.md](./STAGE_0_CLOSURE_REPORT.md)  
5. [ARCHITECTURE.md](./ARCHITECTURE.md) — linkage model  
6. This document

---

## 1. Stage 1 Objective (Clinical Design Scope)

Make **clinical design entities** first-class citizens of the Protocol Store—not read-only graph seed data—so authors can create, read, update, and relate structured objects (objectives, endpoints, assessments, visits, arms, populations, interventions, statistical analyses, etc.) through the same canonical `ProtocolDocument` that powers document fields, SoA, and dependency graphs.

**Guiding question (from architecture vision):**

> Does this strengthen the standards-aware Clinical Design Model, or fragment protocol truth across views?

---

## 2. Current State (Post–Stage 0)

| Capability | State |
|------------|--------|
| `clinicalDesign` in seed + store | ✅ Modeled in `types.ts`; populated in `PROTO-XYZ-301.json` |
| Graph read path | ✅ `selectDependencyNodes/Edges` from store |
| Document field edits | ✅ `updateElementValue()` only |
| Clinical design mutations | ❌ None |
| Relationship mutations | ❌ None |
| Entity editing UI | ❌ Graph/inspector read-only |
| Schedule ↔ design sync on edit | ❌ Partial `entityId` links; no write path |
| Live validation | ❌ Static `validationIssues` in seed |

**Existing `DesignEntity` shape:**

```typescript
{ id, type, name, description?, sectionRef?, status[], metadata? }
```

**Existing entity groups:** objectives, endpoints, estimands?, assessments, visits, studyArms, populations, eligibilityCriteria, interventions, statisticalAnalyses, biomarkers?, safetyAssessments?

---

## 3. Target End State (Stage 1 — Clinical Design Track)

At Stage 1 completion for this track:

1. **Writable clinical design** — store mutations for entity CRUD and relationship CRUD  
2. **Single source of truth preserved** — graph, inspector, and any edit surfaces read/write through store + selectors  
3. **Referential integrity** — `validateProtocol()` extended for entity/relationship edits  
4. **Minimal authoring UX** — edit entity name/description/sectionRef/status from Dependency Inspector (or adjacent panel) without new graph visual behavior  
5. **Export fidelity** — edited entities appear in JSON export immediately  
6. **Lifecycle hook** — `metadata.updatedAt` + optional audit event stub on clinical design changes  
7. **Foundation for Stage 3** — mutation API designed to later sync `schedule.entityId` links  

**Explicitly not required for this track:** DOCX/PDF ingestion, Standards Repository, live validation engine, Copilot AI, full SoA configuration tool, Supabase persistence UI.

---

## 4. Design Principles

1. **Mutations live in `store/mutations.ts`** (or focused modules re-exported from there)—not in React components.  
2. **Selectors remain the adapter boundary**—extend selectors before teaching components about `DesignEntity` internals.  
3. **Preserve graph parity**—after mutations, `getDependencyNodes()` / `getDependencyEdges()` must remain consistent; update parity fixtures when selector output intentionally changes.  
4. **IDs are stable**—generate with predictable prefixes (`obj-`, `ep-`, etc.); never re-key on rename.  
5. **Relationships reference entity ids only**—not display names.  
6. **Small PRs**—one task id per PR where possible (mirror Stage 0 discipline).  
7. **No UI behavior change until mutation API exists**—wire UI only after domain tests pass.

---

## 5. Implementation Phases & Tasks

### Phase 1 — Domain mutation API (S1-1 → S1-5)

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S1-1** | Entity lookup helpers | S | `findDesignEntity(document, id)`, `getDesignEntityGroup(type)`, `collectAllDesignEntities()` in `domain/protocol/clinicalDesign/` |
| **S1-2** | `updateDesignEntity()` | M | Patch `name`, `description`, `sectionRef`, `status`, `metadata` by entity id; touch `metadata.updatedAt` |
| **S1-3** | `createDesignEntity()` | M | Insert into correct `clinicalDesign` array; assign id + type; optional default `sectionRef` |
| **S1-4** | `deleteDesignEntity()` | M | Remove entity; cascade or block if `relationships` reference id (prefer block + error in Stage 1) |
| **S1-5** | Relationship mutations | M | `addRelationship`, `updateRelationship`, `removeRelationship`; validate source/target exist |

**Exit criteria:** Unit-testable mutations via `vite-node` script or small test module; `validate:protocol` passes on seed; mutated snapshot passes validation.

---

### Phase 2 — Validation & integrity (S1-6 → S1-8)

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S1-6** | Extend `validateProtocol()` | S | Unique entity ids across all groups; relationship endpoints exist after edits |
| **S1-7** | `validateClinicalDesign()` helper | S | Optional focused validator returning errors/warnings for design layer only |
| **S1-8** | Dev mutation smoke script | S | `scripts/smoke-clinical-design-mutations.ts` — create/edit/delete round-trip on copy of store |

---

### Phase 3 — Selectors & view DTOs (S1-9 → S1-11)

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S1-9** | `getDesignEntity(id)` selector | S | Public getter for inspector/edit surfaces |
| **S1-10** | `selectDesignEntitiesByType(type)` | S | Filtered lists for future panels |
| **S1-11** | Inspector DTO adapter | S | Map `DesignEntity` → existing `DependencyNode` shape (already partial); add reverse patch helper for edits |

**Note:** Prefer extending `DependencyNode` metadata rather than new parallel DTO types unless inspector needs fields not in graph model.

---

### Phase 4 — Minimal edit UX (S1-12 → S1-15)

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S1-12** | DependencyInspector edit mode | M | When node selected: editable name, description, sectionRef (dropdown of section ids); Save → `updateDesignEntity()` |
| **S1-13** | Store subscribe in graph shell | S | Refresh graph node labels after mutation (subscribe → re-read nodes or local optimistic update) |
| **S1-14** | Status chips edit (optional) | S | Toggle `GraphEntityStatus[]` on entity—multi-select or preset |
| **S1-15** | Create entity stub (optional) | M | “Add objective” / “Add endpoint” from inspector or graph context menu—calls `createDesignEntity()` |

**UX constraint:** No change to graph layout algorithms, 3D camera, or explorer tree in this track.

---

### Phase 5 — Cross-view consistency (S1-16 → S1-18)

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S1-16** | Schedule link helper | M | When assessment/visit entity renamed, optionally sync `schedule.*.label` where `entityId` matches |
| **S1-17** | `linkedSectionId` cleanup (seed) | S | Fix schedule assessment `linkedSectionId` values to existing sections or parent ids |
| **S1-18** | Linkage documentation update | S | Update ARCHITECTURE.md with write-path diagram |

---

### Phase 6 — Governance & amendment scaffolding (S1-19 → S1-21)

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S1-19** | Audit stub on design mutation | S | Append to `collaboration.auditEvents` on entity/relationship change (minimal record) |
| **S1-20** | `lifecycleStatus` transitions | S | Helper `setLifecycleStatus()`; no UI required beyond export reflecting value |
| **S1-21** | Snapshot diff utility | M | `diffProtocolSnapshots(a, b)` for clinical design + relationships sections—CLI only |

---

### Phase 7 — Documentation & sign-off (S1-22 → S1-24)

| ID | Task | Complexity | Description |
|----|------|------------|-------------|
| **S1-22** | Update PRODUCT_ROADMAP Stage 1 status | S | Track clinical design track separately from ingestion track |
| **S1-23** | Stage 1 smoke test checklist | S | Mirror Stage 0 format in new `STAGE_1_COMPLETION.md` |
| **S1-24** | Parity fixture regen policy | S | Document when to run `generate:parity-fixtures` after selector changes |

---

## 6. Recommended Implementation Sequence

```
S1-1 → S1-2 → S1-3 → S1-4 → S1-5     (mutation API)
        ↓
S1-6 → S1-7 → S1-8                   (validation)
        ↓
S1-9 → S1-10 → S1-11                  (selectors)
        ↓
S1-12 → S1-13                          (minimal inspector edit — MVP)
        ↓
S1-16 → S1-17 → S1-18                  (cross-view)
        ↓
S1-19 → S1-21                          (governance)
        ↓
S1-14, S1-15 (optional) → S1-22–S1-24 (sign-off)
```

**First PR recommendation:** **S1-1 + S1-2** (`findDesignEntity` + `updateDesignEntity`) — smallest vertical slice proving writable clinical design without UI.

**MVP milestone (Stage 1a):** S1-1 through S1-13 — edit existing graph node properties and see export + graph update.

**Full clinical design track (Stage 1b):** through S1-21.

---

## 7. Definition of Done (Clinical Design Track)

Stage 1 clinical design work is **complete** when:

### Domain

- [ ] CRUD mutations exist for `DesignEntity` in all seed-populated groups  
- [ ] Relationship add/remove/update mutations exist  
- [ ] All mutations touch `metadata.updatedAt`  
- [ ] `npm run validate:protocol` passes after representative edits  

### Views

- [ ] Dependency Inspector can save entity field edits to store  
- [ ] Graph reflects edits without separate mock state  
- [ ] Export JSON includes edited entities and relationships  

### Integrity

- [ ] Deleted entity blocked when referenced by relationships  
- [ ] `sectionRef` values validated on entity update  

### Verification

- [ ] `npm run build` passes  
- [ ] `npm run test:parity` passes (fixtures updated if needed)  
- [ ] Stage 1 smoke test checklist recorded  

---

## 8. Out of Scope (Stage 1 Clinical Design Track)

| Item | Deferred to |
|------|-------------|
| DOCX / PDF ingestion | Stage 1 separate track (roadmap) |
| Estimand-specific structured fields | Later; use generic `DesignEntity` first |
| Full amendment diff UI | Stage 1 governance track (S1-21 foundation only) |
| SoA matrix editing | Stage 3 |
| Standards-aware validation | Stage 2–4 |
| Copilot-proposed entity changes | Stage 5 |
| Supabase / multi-user persistence | Stage 1+ parallel track |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Mutations bypass selectors; UI forks truth | Code review rule: components call `domain/protocol` mutations only |
| Graph and schedule drift after rename | S1-16 sync helper; document manual link steps until Stage 3 |
| Parity fixture churn | Regenerate fixtures only when selector output intentionally changes |
| Over-building entity types per M11 subsection | Keep single `DesignEntity` shape; add typed extensions in Stage 2+ |
| Inspector scope creep | Limit Stage 1 edit fields to name, description, sectionRef, status |

---

## 10. Verification Commands

```bash
npm run build
npm run test:parity
npm run validate:protocol
# After S1-8:
npm run smoke:clinical-design   # proposed script
```

---

## 11. Parallel Track (Not This Plan)

The roadmap also lists **Legacy Protocol Conversion** (DOCX/PDF) under Stage 1. Treat that as a **separate implementation plan** after clinical design mutations are stable—ingestion must target the same `ProtocolDocument` / `clinicalDesign` shapes defined here.

---

## 12. Success Statement

Stage 1 clinical design work succeeds when a user can **select an objective in the dependency graph, edit its structured properties, export the protocol JSON, and see the same objective updated in `clinicalDesign.objectives`**—with relationships intact and graphs unchanged except for updated labels/status.

That proves the platform is a **protocol engineering environment**, not a form editor with a decorative graph.
