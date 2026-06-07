# Title Page M11 Redesign

## Regulatory principle

The ICH M11 Template states: **"The order of the title page elements should be preserved."**

M11 Studio now treats the Title Page as an **ordered regulatory artifact**, not a metadata form grouped by Required / Optional / Conditional status.

## Architecture

### Author content layer

- `TitlePageModel` — canonical field values keyed by M11 element id
- `ProtocolElement[]` — persisted storage (backward compatible)
- Ordered narrative serialization for validation workflow parity

### Presentation layer

- Conformance badges (Required / Optional / Controlled Terminology)
- Conditional visibility (does not reorder fields)
- Viewing-mode collapse for empty optional fields

## TitlePageModel

Location: `src/app/domain/protocol/authoring/titlePageModel.ts`

Every element defines:

| Property | Purpose |
|----------|---------|
| `sequence` | Canonical M11 order (1–24) |
| `label` | Display label |
| `conformance` | `required` / `optional` / `conditional` |
| `cardinality` | `one_to_one` / `one_to_many` |
| `visibilityRules` | Conditional show/hide |
| `repeatable` | Enables Add Another control |
| `helpText` | Author guidance |
| `aliases` | Import extraction + fuzzy label matching |
| `controlledTerminologyCodeList` | M11 codelist binding |

### Canonical sequence

1. Sponsor Confidentiality Statement  
2. Full Title  
3. Trial Acronym  
4. Sponsor Protocol Identifier  
5. Original Protocol  
6. Version Number  
7. Version Date  
8. Amendment Identifier *(conditional)*  
9. Amendment Scope *(conditional)*  
10. Sponsor Investigational Product Code(s) *(repeatable)*  
11. Investigational Product Name(s) *(repeatable)*  
12. Trial Phase  
13. Short Title  
14. Sponsor Name and Address  
15. Co-Sponsor Name and Address *(repeatable)*  
16. Local Sponsor Name and Address *(repeatable)*  
17. Device Manufacturer Name and Address *(repeatable)*  
18. Regulatory or Clinical Trial Identifier(s) *(repeatable)*  
19. Sponsor Approval  
20. Sponsor Signatory  
21. Medical Expert Contact  
22. Country Identifier *(conditional)*  
23. Region Identifier *(conditional)*  
24. Site Identifier *(conditional)*  

## Conditional logic

| Condition | Effect |
|-----------|--------|
| Original Protocol = Yes | Hide amendment identifier, amendment scope, country/region/site identifiers |
| Original Protocol = No | Show amendment identifier and amendment scope |
| Amendment Scope = Not Global | Show country, region, and site identifiers |

## TitlePageValidationEngine

Location: `src/app/domain/protocol/authoring/titlePageValidationEngine.ts`

- Derives validation from M11 conformance metadata and `validationRuleIds`
- No hardcoded per-field checks outside the model catalog
- Controlled terminology validation via M11 codelists
- Cross-field rules: `if_no_then_amendment_fields_required`, `if_not_global_then_scope_identifiers_required`

## TitlePageExtractionAgent

Locations:

- `src/app/agents/TitlePageExtractionAgent.ts`
- `src/app/agents/titlePageExtractionRunner.ts`
- `src/app/domain/protocol/authoring/titlePageExtractionRules.ts`

Runs **before narrative reconstruction** during import (after Core Study Model, before section generation).

Extracts from:

- DOCX title-page free text (pre-first-heading region)
- DOCX tables
- Knowledge model hints (study title, sponsor, phase, identifier)

Maps values into `TitlePageModel` using M11 aliases and fuzzy label matching, then hydrates `document.elements`.

## UI

Location: `src/app/components/authoring/TitlePageViewport.tsx`

- Renders fields in canonical sequence only
- Badges: red Required, gray Optional, blue Controlled Terminology
- Repeatable fields: Add Another
- Viewing mode: empty optional fields collapsed (not removed)
- Required fields always shown

## Migration

Location: `src/app/domain/protocol/authoring/titlePageMigration.ts`

- Adds missing canonical elements to existing protocols
- Preserves legacy values
- Moves legacy `title_page.amendment_scope` from amendment section to title section
- Invoked on blank workspace creation, seed load, and import hydration

## Verification

```bash
npm run build
npm run test:title-page-m11-redesign
npm run test:authoring
```

Screenshots: `scripts/capture-title-page-screenshot.mjs` (requires preview on port 5175)

## Known limitations

- Extraction confidence is heuristic; complex DOCX layouts may need manual review
- Rich-text title page blocks (non-tabular) remain label-pattern dependent
- Element-level ICH technical specification bindings remain partial in `ichM11TechnicalSpecification.ts`

## Recommended next step (Protocol Hardening Sprint)

Validate title page extraction against real imported protocols and tune alias/fuzzy matching from production documents.
