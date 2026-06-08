# USDM Alignment Foundation

Study Design Studio v3 maps the author-facing Study Design model into USDM-compatible JSON **without exposing USDM terminology in the primary UI**. Authors continue working with arms, epochs, visits, activities, milestones, and schedule rules; export silently produces OpenStudyBuilder-shaped schedule data.

Reference analyzed: `fixtures/usdm/Study_000003_USDM.json` (OpenStudyBuilder export for Study_000003).

---

## Reference analysis (OpenStudyBuilder USDM JSON)

### Top-level shape

```json
{
  "study": {
    "id": "...",
    "name": "...",
    "versions": [
      {
        "id": "StudyVersion_1",
        "studyIdentifiers": [],
        "studyDesigns": [ /* primary design */ ]
      }
    ]
  }
}
```

Observed counts in reference fixture:

| Entity | Count |
|--------|------:|
| Study versions | 1 |
| Study designs | 1 |
| Arms | 2 |
| Epochs | 4 |
| Elements | 8 |
| Encounters | 43 |
| Activities | 205 |
| Schedule timelines | 1 |
| Timings | 43 |
| Scheduled activity instances | 43 |

### Key structures

| USDM path | Purpose |
|-----------|---------|
| `study.versions[].studyDesigns[]` | Container for design-time schedule |
| `studyDesign.arms[]` | Treatment arms (`StudyArm`) |
| `studyDesign.epochs[]` | Study epochs (`StudyEpoch`) |
| `studyDesign.elements[]` | Design elements (`StudyElement`) |
| `studyDesign.encounters[]` | Visits (`Encounter`) with `scheduledAtId` → `Timing` |
| `studyDesign.activities[]` | Activities with `definedProcedures[]` |
| `studyDesign.scheduleTimelines[]` | Main timeline (`ScheduleTimeline`) |
| `scheduleTimeline.timings[]` | Visit timing / windows (`Timing`) |
| `scheduleTimeline.instances[]` | Scheduled rows (`ScheduledActivityInstance`) |

Reference encounter pattern:

- `Encounter.scheduledAtId` references a `Timing` id
- `Encounter.previousId` / `nextId` chain visits
- `Timing.value` uses ISO-8601 duration (e.g. `P5D`)
- `Timing.windowLower` / `windowUpper` express visit windows

Reference scheduled instance pattern:

- One instance per encounter (43 encounters → 43 instances)
- `ScheduledActivityInstance.epochId` links to epoch
- `ScheduledActivityInstance.activityIds[]` lists activities at that visit
- `ScheduledActivityInstance.timelineId` links to main timeline

---

## Practical mapping (Study Design → USDM)

| Study Design | USDM-lite | Notes |
|--------------|-----------|-------|
| `arms[]` | `StudyArm` | Arm `type` → `Code` |
| `epochs[]` | `StudyEpoch` | Epoch name → type code; chained `previousId`/`nextId` |
| `elements[]` | `StudyElement` | Optional design cells |
| `visits[]` | `Encounter` | `scheduledAtId` from visit timing |
| `activities[]` | `Activity` | Each gets placeholder `Procedure` in `definedProcedures` |
| `scheduleRules[]` | `ScheduledActivityInstance` | Grouped by visit; `activityIds` from rules |
| Visit windows / nominal day | `Timing` | ISO duration + window fields |
| (derived) | `ScheduleTimeline` | Single main timeline with all timings + instances |

Context inputs (not shown as USDM to authors):

- Protocol title → `studyDesign.name`
- Sponsor protocol identifier → `study.name`, `studyIdentifiers`
- Trial phase → `studyDesign.studyPhase`
- Knowledge graph / SoA summaries → export metadata only (future)

---

## Module layout

```
src/app/domain/usdm/
  usdmTypes.ts           # USDM-lite types
  usdmExportTypes.ts     # Export context, readiness, validation result types
  usdmIdFactory.ts       # Deterministic stable IDs
  usdmMapper.ts          # mapStudyDesignToUsdm()
  usdmValidation.ts      # validateUsdmExport(), summarizeUsdmReference()
  usdmSelectors.ts       # evaluateUsdmExportReadiness()
  usdmExportStore.ts     # buildUsdmExport(), downloadUsdmJson()
  index.ts
```

---

## Stable ID factory

`createUsdmIdFactory(seed)` produces deterministic IDs:

- Prefer `{UsdmType}_{sanitizedSourceId}` when study design entity ids are stable
- Fall back to hash-based suffix for opaque ids
- Same seed + same entity → same USDM id across exports

Examples: `StudyArm_manual_arm_drug_a`, `Encounter_visit_baseline`, `Timing_visit_baseline`.

---

## Validation

### Errors (block export dialog download)

- Missing study / version / design
- Encounter without `scheduledAtId` or with missing timing
- Scheduled instance without `encounterId`, `activityIds`, or `epochId`
- Duplicate USDM ids

### Warnings (allow “Download anyway”)

- Activity without procedure (should not occur — mapper adds placeholder)
- Arm / epoch without type code
- Visit without epoch
- Missing trial phase or protocol identifier

---

## Export behavior

**File → Export USDM JSON**

1. Build USDM from current Study Design + protocol context
2. Validate export
3. If errors → readiness dialog (no download)
4. If warnings only → readiness dialog with **Download anyway**
5. If ready → direct JSON download

Filename: `{sponsor-protocol-id}-usdm.json`

Authors never see a raw JSON editor.

---

## Readiness panel (Study Design Summary)

**Schedule Export Readiness** (not labeled “USDM”):

| State | Meaning |
|-------|---------|
| Not ready | No Study Design or blocking export errors |
| Ready with warnings | Exportable; missing title-page metadata or soft issues |
| Ready | Clean export |

Shows missing fields, first blocking error, and exportable counts (visits, activities, schedule rows).

---

## Agent scaffold

```
src/app/agents/UsdmAlignmentAgent.ts
src/app/agents/usdmAlignmentRules.ts
src/app/agents/usdmAlignmentRunner.ts
```

- Inspects Study Design + export readiness
- Emits suggestions (e.g. missing epoch, missing trial phase)
- **Does not auto-apply**
- No LLM in v1

---

## Mapping coverage (v3 foundation)

| Area | Coverage |
|------|----------|
| Arms, epochs, elements | Full lite mapping |
| Visits → encounters | Full with timing link |
| Activities + placeholder procedures | Full |
| Schedule rules → instances | Grouped by visit |
| Visit windows / nominal timing | Timing value + windows |
| Milestones | Not exported in v3 (v2 model retained; USDM v2) |
| Schedule anchors | Partially reflected in timing value (offset days) |
| SoA matrix | Not duplicated — schedule instances derive from Study Design rules |
| Full USDM study metadata | Minimal (title, phase, identifiers only) |

---

## Known limitations

1. **Not full USDM** — many OSB fields (interventions, estimands, BCs, etc.) are omitted
2. **Placeholder procedures** — every activity gets a synthetic `Procedure`; no CDISC procedure coding yet
3. **Single main timeline** — no branching / exit timelines
4. **Milestone export** — deferred to USDM v2
5. **No USDM import** — reference parser is test-only (`summarizeUsdmReference`)
6. **Code systems** — use `M11Studio` sponsor codes, not full CT catalog alignment

---

## Recommended USDM v2 direction

1. Map milestones to USDM timing anchors / scheduled instances
2. Rich procedure coding from SoA assessment catalog
3. Multi-timeline support (screening vs treatment)
4. Round-trip import from OSB JSON for regression parity
5. CDISC CT / USDM code system integration
6. Export bundle: USDM JSON + provenance manifest linking Study Design entity ids

---

## Verification

```bash
npm run build
npm run test:usdm-alignment-foundation
npm run test:study-design-foundation
npm run test:study-design-v2
npm run test:soa-agent
npm run test:soa-knowledge
npm run smoke:app-startup
npm run smoke:protocol-import
npm run validate:protocol
```
