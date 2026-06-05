# ICH M11 Settings & Protocol Explorer — Feature Plan

## Scope

UI and static local data only. No live ICH fetching. No changes to SoA generation, protocol editing workflows, or schedule domain behavior.

## Static source documents

| Document | Role | Source file | Notes |
|----------|------|-------------|--------|
| **ICH M11 Technical Specification** | Reference for data elements, conformance, value constraints | Static scaffold (abbreviated index) | Not used for Protocol Explorer tree |
| **ICH M11 Template** | Authoritative Protocol Explorer TOC | `ICH_Step4_M11_Final_Template_2025_1119.pdf` | Final; adopted **19 November 2025** |

### Template source facts

- **Title:** Clinical Electronic Structured Harmonised Protocol (CeSHarP), M11 Template  
- **Version:** Final  
- **Adopted:** 19 November 2025  
- Includes complete protocol template hierarchy and table of contents  
- **Section 1.3 Schedule of Activities** — procedures at each visit and all participant contact; eligibility / randomization / stratification / discontinuation tests; allowable windows for visits and procedures  

## Settings → ICH M11 UI

Two document cards:

1. **Technical Specification** — document name, version/status, loaded date, source filename, parsed section count (abbreviated index), badge **Static local specification**  
2. **Template** — document name, Final version, adopted date, `ICH_Step4_M11_Final_Template_2025_1119.pdf`, full template section count, **Static local specification**

Additional panels: Section 1.3 guidance quote, scaffold limitations, legacy seed mapping notes, flat template hierarchy preview.

## Protocol Explorer

- Tree built from **`ICH_M11_TEMPLATE_SECTION_SPECS`** via `mergeProtocolSectionsWithIchM11()` at store load  
- Includes **Section 0 Foreword** (0.1–0.4) marked `ichM11InstructionOnly` — template metadata, not finalized protocol body  
- **Section 1.3** retains `viewKind: schedule-of-activities` → SoA Configuration workspace  
- New template sections without content → empty state: *"This section is defined by the ICH M11 Template but has not yet been authored."*  
- Instruction sections → *"…template instructions…not part of the finalized protocol body."*  
- Existing authored overlays preserved where section ids match; statistical content remapped from misplaced id `9` → template **10** when title indicates Statistical  

## Implementation modules

| Module | Purpose |
|--------|---------|
| `ichM11/types.ts` | Shared types |
| `ichM11/ichM11Template.ts` | Full CeSHarP TOC (~170 nodes) |
| `ichM11/ichM11TechnicalSpecification.ts` | Tech spec meta + abbreviated index |
| `ichM11/mergeProtocolSectionsWithIchM11.ts` | Merge template + seed overlays |
| `components/settings/IchM11SettingsPanel.tsx` | Dual document cards |
| `scripts/rebuild-protocol-sections-from-ich-m11.ts` | Persist merged tree to seed JSON |

## M11 Template Reference (authoring)

- Protocol Explorer **Template Reference** toggle (persisted in `localStorage`)
- Side-by-side `SectionAuthoringCanvas`: protocol content + `M11TemplateReferencePanel` subdrawer
- Per-section static reference in `ichM11TemplateSectionReference.ts` (read-only; never writes protocol)
- Section 1.3: SoA Configuration unchanged; template panel shows SoA guidance

## Static PDF assets

- `/reference/ICH_Step4_M11_Final_Template_2025_1119.pdf`
- `/reference/ICH_M11_Technical_Specification.pdf`
- Settings cards: **View** (new tab) and **Download**

## Verification

```bash
npm run build
npm run test:parity
npm run validate:protocol
npm run smoke:schedule
npm run smoke:clinical-design
npm run compare:generated-schedule
npm run test:schedule-parity
npm run rebuild:protocol-sections   # after template data edits
npm run generate:parity-fixtures
M11_BASE_URL=http://localhost:PORT/ npm run smoke:ui-settings
```

### Playwright smoke (`smoke:ui-settings`)

1. Open app  
2. Settings → ICH M11 — both document cards visible  
3. Protocol Explorer — Foreword, Section 10 Statistical, expanded template TOC  
4. Section 1.3 — SoA Configuration  
5. Empty template section (e.g. 6.1) — template empty state  
6. Foreword / 0.1 — instruction empty state  

## Known limitations

- Technical Specification is metadata + abbreviated index only (no full PDF extract)  
- Template `<#>` placeholders are single nodes, not repeated instances  
- `12.X` is one placeholder appendix node  
- PDF file is referenced by filename; not bundled in repo unless added under `src/app/domain/protocol/ichM11/sources/`  
