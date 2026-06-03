# M11 Studio — Protocol Domain Migration Status

**Last updated:** 2026-06-03  
**Migration phase:** Complete  
**Stage 0:** Complete — see [STAGE_0_CLOSURE_REPORT.md](./STAGE_0_CLOSURE_REPORT.md)  
**Canonical artifact:** `src/app/domain/protocol/seed/PROTO-XYZ-301.json`  
**Runtime source of truth:** Protocol Store (`src/app/domain/protocol/store/`)

---

## Executive Summary

The migration from parallel mock datasets to a unified canonical protocol model is **complete**. Stage 0 foundation work is **complete**.

- **Runtime:** All UI paths load data through selector/adapters backed by the in-memory Protocol Store.
- **Field edits:** Document Viewport changes persist via `updateElementValue()`; `metadata.updatedAt` updates on each edit.
- **Export:** `downloadProtocolJson()` serializes the live store snapshot.
- **Integrity:** `validateProtocol()` + `npm run validate:protocol`; dev-on-load logging via `logDevProtocolValidation()`.
- **Parity:** `npm run test:parity` compares selectors to JSON fixtures.
- **Legacy mocks:** Deleted. Parity and runtime use the domain layer only.

**Verification:**

```bash
npm run build             # passes
npm run test:parity       # passes (fixture-based)
npm run validate:protocol # passes (structural integrity)
```

---

## Clinical Design Linkage Model

Cross-view identity is defined in the canonical `ProtocolDocument`:

| Layer | Location | Key fields | Used by |
|-------|----------|------------|---------|
| **Clinical design entities** | `clinicalDesign.*` | `id`, `sectionRef`, `type` | 2D/3D graph nodes, relationships, optional schedule `entityId` |
| **Schedule** | `schedule.*` | `id`, optional `entityId`, `linkedSectionId` | SoA grid (`viewKind: schedule-of-activities`) |
| **Relationships** | `relationships[]` | `sourceId`, `targetId` | Graph edges (2D and 3D) |
| **Sections** | `sections[]` | `id`, optional `viewKind` | Explorer, viewport routing, graph navigation target |
| **Elements** | `elements[]` | `id`, `sectionId` | Document field authoring |

**Linkage strategy (Stage 0):**

1. Graph nodes are `clinicalDesign` entities; navigation uses `sectionRef` → section `id`.
2. SoA rows/columns live in `schedule`; cells reference `visitId` + `assessmentId`.
3. Optional `schedule.*.entityId` links grid rows to `clinicalDesign` ids where populated (partial in seed).
4. All views read the same store document—no duplicate entity registries.

Full detail: [ARCHITECTURE.md](./ARCHITECTURE.md#clinical-design-linkage-model).

---

## Completed Work

### Domain foundation

| Item | Location | Status |
|------|----------|--------|
| Canonical types + metadata | `types.ts` | ✅ |
| Seed JSON | `seed/PROTO-XYZ-301.json` | ✅ |
| Protocol Store | `store/` | ✅ |
| Selectors | `selectors/` | ✅ |
| Export | `export/` | ✅ |
| Structural validation | `validateProtocol.ts` | ✅ |
| Fixture parity | `parity/fixtures/` | ✅ |

### Integrity & navigation (S0-5 → S0-8)

| Item | Status |
|------|--------|
| `validateProtocol()` + `npm run validate:protocol` | ✅ |
| Dev validation on store load | ✅ |
| Graph `sectionRef` → valid sections | ✅ |
| SoA via `viewKind` (not hardcoded `1.3`) | ✅ |
| Linkage model documented | ✅ |

### Artifact metadata (S0-13)

Seed metadata includes: `createdAt`, `updatedAt`, `lifecycleStatus`, `authoringMode`, `standardsVersions` (ICH M11, CDISC Core, CT, CDASH, SDTM placeholders).

---

## Runtime Data Flow

```
PROTO-XYZ-301.json
       │  (load once at startup)
       ▼
Protocol Store
       │
       ▼
selectors/ → get*() helpers
       │
       ├── App.tsx (authoring, SoA, validation, export)
       ├── DependencyGraphNodeEditor / DependencyGraph3D
       └── DependencyInspector
```

---

## Deferred to Later Stages

| Item | Stage |
|------|-------|
| Live validation engine | 4 |
| Full schedule `entityId` coverage | 3 |
| Standards Repository | 2 |
| Protocol Copilot (store-backed) | 5 |
| Persistence / Supabase | 1+ |
| Schedule `linkedSectionId` cleanup | 1–3 |

---

## Migration Checklist

- [x] Canonical types defined
- [x] Seed JSON authored
- [x] Selectors + fixture parity
- [x] Runtime wired to store
- [x] Protocol Store read/write/export
- [x] Legacy mocks deleted
- [x] Structural validation
- [x] Cross-view linkage documented
- [x] Stage 0 sign-off complete

**Stage 0: complete. Ready for Stage 1.**
