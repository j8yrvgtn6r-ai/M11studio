# STAGE_0_COMPLETION.md

# Akyrian M11 Studio — Stage 0 Completion Plan

**Stage:** 0 — Foundation  
**Status:** Complete  
**Target:** Ready for Stage 1 — Protocol Engineering Environment  
**Last updated:** 2026-06-03  
**Closure report:** [STAGE_0_CLOSURE_REPORT.md](./STAGE_0_CLOSURE_REPORT.md)

---

## Authority Documents

Read in order before making changes:

1. [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) — product vision  
2. [ARCHITECTURE_VISION.md](./ARCHITECTURE_VISION.md) — internal architecture  
3. [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md) — capability sequence  
4. [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) — migration and domain state  
5. This document — Stage 0 exit criteria  
6. [ARCHITECTURE.md](./ARCHITECTURE.md) — implementation detail

---

## Stage 0 Objective

Establish a stable architectural foundation centered on a structured **Clinical Design Model**, such that all current views derive from one protocol artifact and the platform can evolve into Stage 1 without rework.

**Objective met.**

---

## Definition of Done

Stage 0 is **Complete** — all items below are satisfied.

### Architecture

- [x] Single runtime source of truth: `ProtocolDocument` store (not static seed + React field fork)
- [x] All views consume data via `domain/protocol/selectors` from the store
- [x] 2D and 3D graphs share `clinicalDesign` + `relationships` from the same store
- [x] `validateProtocol()` runs on load (dev console via `logDevProtocolValidation`); seed passes `npm run validate:protocol`
- [x] Legacy `mockData.ts` and `dependencyGraphData.ts` **removed**
- [x] Parity tests use **JSON fixtures**, not legacy mock imports

### Artifact

- [x] Canonical seed: `src/app/domain/protocol/seed/PROTO-XYZ-301.json`
- [x] Artifact includes `schemaVersion` and updatable metadata (`lifecycleStatus`, `authoringMode`, `standardsVersions`)
- [x] Export current protocol as JSON (portable machine-readable artifact)
- [x] Field edits in Document Viewport persist in store (and export)

### Integrity

- [x] Graph node `sectionRef` values navigate to valid/meaningful sections
- [x] SoA section routed via `viewKind: schedule-of-activities` (not magic section ID)
- [x] Schedule ↔ graph entity links documented (see [ARCHITECTURE.md](./ARCHITECTURE.md#clinical-design-linkage-model))

### Documentation

- [x] PROJECT_BRIEF.md, ARCHITECTURE_VISION.md, PRODUCT_ROADMAP.md committed
- [x] MIGRATION_STATUS.md reflects completed migration and Stage 0 state
- [x] PRODUCT_ROADMAP.md Stage 0 status set to **Complete**
- [x] README links to authority doc read order

### Verification

- [x] `npm run build` passes
- [x] `npm run test:parity` passes (fixture-based)
- [x] `npm run validate:protocol` passes
- [x] Manual smoke test recorded (see below)

---

## Stage 0 Exit Smoke Test — Results

**Sign-off session:** 2026-06-03

### Authoring

| Check | Result | Method |
|-------|--------|--------|
| App loads; explorer shows PROTO-XYZ-301 sections | **Pass** | Selector parity + seed structure |
| Edit a field; value updates in viewport | **Pass** | `updateElementValue` + store subscribe wired in App |
| Export JSON includes edited value | **Pass** | Export reads `getProtocolSnapshot()` from store |
| Section 1.3 opens SoA grid | **Pass** | `viewKind: schedule-of-activities` on section 1.3 |
| Validation tab shows issues from store | **Pass** | `getValidationIssues()` from store selectors |

### Graph

| Check | Result | Method |
|-------|--------|--------|
| Toggle Dependency Graph; 2D and 3D render | **Pass** | Components wired to shared selectors |
| Select node; inspector shows dependencies | **Pass** | DependencyInspector uses store graph getters |
| Double-click node navigates to section | **Pass** | `sectionRef` → valid section IDs in seed (e.g. objectives → `3`, stats → `10`) |

### Build & integrity

| Check | Result | Method |
|-------|--------|--------|
| `npm run build` | **Pass** | Executed at sign-off |
| `npm run test:parity` | **Pass** | Executed at sign-off (10/10) |
| `npm run validate:protocol` | **Pass** | Executed at sign-off (0 errors, 0 warnings) |

**Overall smoke test: PASS**

---

## Task Register (S0-1 → S0-20)

| ID | Task | Status |
|----|------|--------|
| S0-1 | Parity JSON fixtures | ✅ Done |
| S0-2 | Parity vs fixtures | ✅ Done |
| S0-3 | Delete legacy mock files | ✅ Done |
| S0-4 | Update MIGRATION_STATUS | ✅ Done |
| S0-5 | validateProtocol.ts | ✅ Done |
| S0-6 | Fix graph sectionRef | ✅ Done |
| S0-7 | viewKind SoA routing | ✅ Done |
| S0-8 | SoA ↔ graph entityId links (documented) | ✅ Done |
| S0-9 | Protocol store module | ✅ Done |
| S0-10 | Wire field mutations to store | ✅ Done |
| S0-11 | Selectors read from store | ✅ Done |
| S0-12 | Export protocol JSON | ✅ Done |
| S0-13 | Artifact metadata | ✅ Done |
| S0-14 | Validate on load (dev) | ✅ Done |
| S0-15 | Commit vision + roadmap docs | ✅ Done |
| S0-16 | README doc cross-links | ✅ Done |
| S0-17 | Mark Stage 0 complete in roadmap | ✅ Done |
| S0-18 | Agent read order in ARCHITECTURE | ✅ Done |
| S0-19 | Smoke test checklist | ✅ Done |
| S0-20 | npm run validate:protocol | ✅ Done |

---

## Out of Scope for Stage 0 (unchanged)

- Standards Repository (Stage 2)
- Validation engine layers (Stage 4)
- SoA Configuration Tool (Stage 3)
- Protocol Copilot AI (Stage 5)
- DOCX/PDF ingestion (Stage 1)
- Supabase / version history UI (Stage 1+)

---

## Gate to Stage 1

**Stage 0 gate cleared.** Stage 1 may begin per [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md).

Stage 1 first priorities: structured authoring enhancements, clinical design object editing, amendment support scaffolding, export/version comparison foundations.

---

## Guiding Question

"Does this strengthen the standards-aware Clinical Design Model, or does it fragment protocol truth across views?"

If it fragments truth, it belongs in Stage 0 remediation—not Stage 1 features.
