# M11 Studio — Protocol Domain Migration Status

**Last updated:** 2026-06-02  
**Migration phase:** Runtime complete — legacy files retained for parity only  
**Canonical artifact:** `src/app/domain/protocol/seed/PROTO-XYZ-301.json`

---

## Executive Summary

The migration from parallel mock datasets (`mockData.ts`, `dependencyGraphData.ts`) to a unified canonical protocol model is **complete for all runtime UI paths**. Every active component now loads data through selector/adapters in `src/app/domain/protocol/selectors/`, backed by the seed JSON artifact.

Legacy mock files remain in the repository **only** to support `npm run test:parity`. They are not imported by the running application.

---

## Completed Work

### Phase 1 — Canonical model (additive)

| Item | Location | Status |
|------|----------|--------|
| Canonical TypeScript types | `src/app/domain/protocol/types.ts` | ✅ Done |
| Seed protocol JSON | `src/app/domain/protocol/seed/PROTO-XYZ-301.json` | ✅ Done |
| Protocol loader | `src/app/domain/protocol/loadProtocol.ts` | ✅ Done |
| Public domain API | `src/app/domain/protocol/index.ts` | ✅ Done |

### Phase 2 — Selectors & parity (additive)

| Item | Location | Status |
|------|----------|--------|
| View DTO selectors | `src/app/domain/protocol/selectors/` | ✅ Done |
| Parity deep-equal utility | `src/app/domain/protocol/parity/deepEqual.ts` | ✅ Done |
| Parity check runner | `src/app/domain/protocol/parity/checkParity.ts` | ✅ Done |
| CLI script | `scripts/check-protocol-parity.ts` | ✅ Done |
| npm script | `npm run test:parity` | ✅ Done |

**Selector functions (all passing parity):**

- `getProtocolSections()`
- `getFieldDefinitions()`
- `getVisits()`, `getAssessments()`, `getSoACells()`
- `getDependencyNodes()`, `getDependencyEdges()`
- `getValidationIssues()`, `getComments()`, `getAuditEvents()`

### Phase 3 — Runtime wiring

| Consumer | Selectors used | Status |
|----------|----------------|--------|
| `App.tsx` | All authoring/SoA/collaboration getters | ✅ Done |
| `DependencyGraphNodeEditor.tsx` | `getDependencyNodes()`, `getDependencyEdges()` | ✅ Done |
| `DependencyGraph3D.tsx` | `getDependencyNodes()`, `getDependencyEdges()` | ✅ Done |
| `DependencyInspector.tsx` | `getDependencyNodes()`, `getDependencyEdges()` | ✅ Done |

### Phase 4 — Cleanup & documentation

| Item | Status |
|------|--------|
| Delete dead `DependencyGraph.tsx` | ✅ Done |
| Update `README.md`, `FEATURES.md`, `ARCHITECTURE.md` | ✅ Done |
| Create `MIGRATION_STATUS.md` (this file) | ✅ Done |

---

## Remaining Work

These items are **out of scope** for the mock-data migration and tracked here for follow-up:

| Item | Priority | Notes |
|------|----------|-------|
| Replace parity baseline with JSON snapshots | Medium | Remove dependency on legacy mock exports |
| Delete `mockData.ts` | Low | After snapshot parity or shim period |
| Delete `dependencyGraphData.ts` | Low | After snapshot parity or shim period |
| Add `@deprecated` JSDoc to legacy files | Low | Optional transitional signal |
| Fix graph `sectionRef` mismatches in seed | Medium | Separate behavior fix; not migration-blocking |
| Replace magic SoA route (`sectionId === '1.3'`) with `viewKind` | Medium | Use `SectionNode.viewKind` from seed |
| Live validation engine (P1) | High | Replace static `validationIssues` in seed |
| Protocol persistence / Supabase | High | Product direction per `PROJECT_BRIEF.md` |
| Wire Copilot to protocol context | Medium | Copilot still uses mock responses |

---

## Legacy Data Import Assessment

### `src/app/data/mockData.ts`

| Importer | Classification | Notes |
|----------|----------------|-------|
| `src/app/domain/protocol/parity/checkParity.ts` | **Parity-only** | Baseline for `npm run test:parity` |

**Runtime imports:** none  
**Dead code imports:** none

### `src/app/data/dependencyGraphData.ts`

| Importer | Classification | Notes |
|----------|----------------|-------|
| `src/app/domain/protocol/parity/checkParity.ts` | **Parity-only** | Baseline for `npm run test:parity` |

**Runtime imports:** none  
**Dead code imports:** none

### Non-import references

| Location | Type |
|----------|------|
| `src/app/domain/protocol/selectors/toCollaboration.ts` | Comment only ("Match legacy mockData Date parsing") |
| `README.md`, `FEATURES.md`, `ARCHITECTURE.md`, `MIGRATION_STATUS.md` | Documentation |

---

## Runtime Data Flow (current)

```
PROTO-XYZ-301.json
       │
       ▼
getProtocolDocument()  ← loadProtocol.ts
       │
       ▼
selectors/  (toProtocolSections, toFieldDefinitions, toSchedule,
             toDependencyGraph, toValidationIssues, toCollaboration)
       │
       ▼
get*() helpers  ← domain/protocol/index.ts
       │
       ├── App.tsx                    (authoring, SoA, validation, collaboration)
       ├── DependencyGraphNodeEditor  (2D graph)
       ├── DependencyGraph3D          (3D graph)
       └── DependencyInspector        (graph sidebar)
```

**Graph sharing:** 2D and 3D views both call `getDependencyNodes()` and `getDependencyEdges()`, which derive from `clinicalDesign` + `relationships` in the same seed JSON.

---

## Files Safe to Delete Later

| File | Prerequisite | Risk |
|------|--------------|------|
| `src/app/components/DependencyGraph.tsx` | — | ✅ Already deleted |
| `src/app/data/mockData.ts` | Parity migrated off legacy baseline | Low (after snapshot tests) |
| `src/app/data/dependencyGraphData.ts` | Parity migrated off legacy baseline | Low (after snapshot tests) |

**Do not delete yet** — parity check still imports both files.

---

## Recommended Deletion Order

When ready to remove legacy mock data:

1. **Add snapshot parity tests** — Store expected selector output as committed JSON fixtures under `src/app/domain/protocol/parity/fixtures/` (or similar).
2. **Update `checkParity.ts`** — Compare selectors against fixtures instead of `mockData.ts` / `dependencyGraphData.ts`.
3. **Verify** — `npm run test:parity` passes with new baseline.
4. **Delete `mockData.ts`** — Grep confirms zero imports.
5. **Delete `dependencyGraphData.ts`** — Grep confirms zero imports.
6. **Update docs** — Remove legacy references from README, FEATURES, ARCHITECTURE, this file.

Optional intermediate step: replace legacy files with thin re-exports from selectors (deprecated shims) for one release cycle before full deletion.

---

## Verification Commands

```bash
npm run build        # Production build
npm run test:parity  # Selector output vs legacy mock exports
```

Both should pass after any migration-related change.

---

## Migration Checklist

- [x] Canonical types defined
- [x] Seed JSON authored from legacy mocks
- [x] Selectors produce matching view DTOs
- [x] Parity test script added
- [x] `App.tsx` wired to selectors
- [x] Graph components wired to selectors
- [x] Dead `DependencyGraph.tsx` removed
- [x] Runtime free of legacy mock imports
- [x] Documentation updated
- [ ] Parity baseline migrated off legacy files
- [ ] Legacy mock files deleted

**Runtime migration: complete.**  
**Repository cleanup: pending parity baseline migration.**
