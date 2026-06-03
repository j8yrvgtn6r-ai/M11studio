# Stage 0 Closure Report

**Project:** Akyrian M11 Studio  
**Stage:** 0 — Foundation  
**Status:** Complete  
**Sign-off date:** 2026-06-03

---

## 1. What Was Accomplished

Stage 0 established a single canonical **Clinical Design Model** backed by an in-memory **Protocol Store**, with all major views reading through domain selectors.

| Phase | Deliverables |
|-------|----------------|
| **Migration** | Canonical types, seed JSON, selectors, fixture-based parity; legacy `mockData.ts` / `dependencyGraphData.ts` removed |
| **Store & export** | Protocol Store (read/write/subscribe), field mutations, JSON export from live snapshot |
| **Integrity** | Structural `validateProtocol()`, dev-on-load check, `npm run validate:protocol`; graph `sectionRef` fixes; SoA routing via `viewKind` |
| **Metadata** | Artifact metadata foundations (`lifecycleStatus`, `authoringMode`, `standardsVersions` placeholders) |
| **Documentation** | Authority docs, migration status, architecture linkage model, Stage 0 sign-off |

**Verification suite (all pass at sign-off):**

```bash
npm run build
npm run test:parity
npm run validate:protocol
```

---

## 2. Architectural State

```
PROTO-XYZ-301.json
       │  (load once at startup)
       ▼
Protocol Store  ← authoritative ProtocolDocument
       │
       ├── mutations (updateElementValue → metadata.updatedAt)
       ├── export (getProtocolSnapshot)
       └── selectors → view DTOs
              │
              ├── App (authoring, SoA, validation, collaboration)
              ├── 2D / 3D dependency graphs
              └── inspectors & status bar
```

**Source of truth:** `src/app/domain/protocol/store/` (initialized from seed JSON).

**Views do not own protocol truth.** Document fields, SoA grid, graphs, validation list, and collaboration data all derive from the same store document via selectors.

**Cross-view linkage model** (see [ARCHITECTURE.md](./ARCHITECTURE.md#clinical-design-linkage-model)):

- **Graph nodes** ← `clinicalDesign` entities; navigation via `sectionRef` → protocol `sections`
- **SoA grid** ← `schedule` (visits, assessments, cells); optional `entityId` → `clinicalDesign`
- **Relationships** ← `relationships[]` (shared by 2D and 3D graphs)

---

## 3. Remaining Technical Debt

These items are **accepted** for Stage 0 and deferred to later stages:

| Item | Target stage | Notes |
|------|--------------|-------|
| Live validation engine | Stage 4 | `validationIssues` remain static seed data |
| Full schedule `entityId` coverage | Stage 3 | Only partial visit/assessment links in seed |
| Schedule `linkedSectionId` cleanup | Stage 1–3 | Some values reference sections not in seed tree (e.g. `8.4`) |
| Protocol Copilot context | Stage 5 | Mock responses only |
| Persistence / Supabase / version UI | Stage 1+ | In-memory store only |
| Standards Repository ingestion | Stage 2 | `standardsVersions` is a placeholder |
| Production on-load validation | Optional | Dev console + CLI; no prod gate |
| Empty `src/app/data/` directory | Cleanup | Unused after mock deletion |

---

## 4. Risks Accepted

| Risk | Mitigation going into Stage 1 |
|------|-------------------------------|
| Static validation issues appear live but are not recomputed | Stage 1+ treats them as seed demo data until Stage 4 engine |
| Partial SoA ↔ clinical design linking | Documented linkage strategy; Stage 3 expands coverage |
| No persistence | Stage 1 export/version scaffolding before Supabase |
| Copilot disconnected from store | No AI mutations until Stage 5 |
| Structural validation only | `validate:protocol` in CI; M11 compliance rules deferred to Stage 4 |

---

## 5. Recommended Stage 1 Starting Point

Per [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md), begin Stage 1 — **Protocol Engineering Environment** with:

1. **Structured authoring enhancements** — extend mutations beyond `updateElementValue` (sections, clinical design entities)
2. **Clinical design object editing** — in-place edit of objectives, endpoints, assessments from graph or dedicated panels
3. **Amendment support scaffolding** — leverage `lifecycleStatus` and metadata for draft/amended workflows
4. **Export / version comparison foundations** — diff two `getProtocolSnapshot()` exports before full persistence

**Do not start:** DOCX/PDF ingestion, Standards Repository, live validation engine, or Copilot AI until core structured editing is stable.

---

## 6. Authority Document Read Order

1. [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)  
2. [ARCHITECTURE_VISION.md](./ARCHITECTURE_VISION.md)  
3. [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)  
4. [MIGRATION_STATUS.md](./MIGRATION_STATUS.md)  
5. [STAGE_0_COMPLETION.md](./STAGE_0_COMPLETION.md)  
6. [ARCHITECTURE.md](./ARCHITECTURE.md) — implementation detail

---

## 7. Sign-Off

Stage 0 Definition of Done is satisfied. The platform is cleared to begin **Stage 1** product work per the roadmap gate.
