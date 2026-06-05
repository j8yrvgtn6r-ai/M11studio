# ICH M11 Controlled Terminology

## Source

- **Title:** ICH M11 Controlled Terminology
- **Host:** NCI EVS
- **URL:** https://evs.nci.nih.gov/ftp1/ICH/M11/ICH%20M11%20Terminology.html
- **Terminology date:** 2025-12-19 (from source page)

## Static artifacts

| Path | Purpose |
|------|---------|
| `src/app/domain/protocol/ichM11/data/ichM11ControlledTerminology.json` | Bundled terminology (imported by app) |
| `public/reference/ichM11ControlledTerminology.json` | Export / download copy |
| `scripts/cache/ich-m11-terminology.html` | Cached HTML from ingest (optional) |

Regenerate: `npm run ingest:ich-m11-terminology`

## Validation API (non-invasive)

- `getM11Codelists()`
- `getM11Codelist(idOrName)`
- `findM11Term(codelistIdOrName, value)`
- `validateM11ControlledTerm(codelistIdOrName, value)` — returns pass/fail + suggested values; does not block editing

## Wired dropdowns

Protocol fields with NCI codelist bindings enriched from static terminology:

- Trial Phase (`C217045`)
- Original Protocol / No–Yes (`C217046`)
- Amendment Scope (`C217047`)

SoA assessment categories remain local controlled vocabulary (no direct M11 assessment-category codelist in ingest).

## Future use

Controlled terminology will later support:

- Validating structured fields against allowed codelists
- Recommending harmonized vocabulary during narrative authoring
- Flagging non-harmonized or sponsor-specific terms
- M11 compliance review workflows
- Copilot suggestions grounded in NCI EVS terms
