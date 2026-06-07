# M11 Template Guidance Layer

## Source template

- `public/reference/ICH_Step4_M11_Final_Template_2025_1119.pdf`
- ICH M11 CeSHarP Template (Final, adopted 19 Nov 2025)
- Section hierarchy from `src/app/domain/protocol/ichM11/ichM11Template.ts`

## Section guidance model

Location: `src/app/domain/m11-template-guidance/`

```typescript
M11SectionGuidance {
  sectionId
  sectionTitle
  headingOnly
  guidanceText[]
  insertionPrompts[]
  controlledTerminologyPrompts[]
  optionalityNotes[]
  conditionalityNotes[]
  notApplicableGuidance?
  tableGuidance?
  sourceReference?
  excludedFromGuidanceUi?
  optionalSection?
  allowsNotApplicable?
}
```

The catalog is built deterministically from ICH section specs plus explicit overrides in `m11TemplateGuidanceCatalog.ts`.

## Heading-only handling

M11 container headings (e.g. Sections 1, 2, 3, …) are marked `headingOnly: true` with guidance **“No text is intended here (heading only).”**

When a blank section is heading-only:

- The generic narrative editor is not shown.
- `M11SectionGuidancePanel` displays the heading-only message.
- Lint/Required Missing does not flag empty heading-only sections.

## Placeholder / instruction separation

- M11 guidance is **presentation-only** — never auto-persisted.
- Editor placeholders come from `getEditorPlaceholderText(sectionId)` (first guidance line), not the generic “Start writing this section…” string.
- Insertion prompt chips insert text **only when the user clicks**.
- `NON_PERSISTED_GUIDANCE_MARKERS` documents strings that must not be saved as protocol content.

## Not Applicable behavior

For optional/conditional sections with `allowsNotApplicable`:

- UI shows **Mark Not Applicable**
- Inserts canonical text: `Not applicable.`
- Aligns with M11 rule: retain heading and indicate not applicable when a section does not apply.

## Lint integration

`m11TemplateGuidanceLintRules.ts`:

| Condition | Lint |
|-----------|------|
| Required content section empty | Error (Required Missing) |
| Heading-only section empty | No required-content error |
| Heading-only with narrative text | Warning |
| Insertion prompt text still present | Warning |

Integrated via `runAllProtocolLintRules()` ahead of structure rules.

## Generation integration

`getGenerationGuidancePayload(sectionId)` supplies concise section guidance to:

- OpenAI M11 generation (`m11GenerationProvider.ts`) as `sectionGuidance` in the LLM JSON payload
- Fixture generation provenance notes (development/smoke)

Full template text is **not** sent for every section — only the relevant guidance object.

## SoA exclusions

Guidance UI is suppressed for:

- `1.3 Schedule of Activities` (SoA tooling)
- Title Page (`TitlePageModel`)
- Amendment Details (`AmendmentDetailsModel`)
- Foreword / template instruction nodes (`0`, `0.x`)

## UI integration

`DocumentViewport.tsx` + `M11SectionGuidancePanel.tsx`:

- Empty narrative sections show section-specific placeholder + collapsible M11 guidance panel
- Heading-only sections show guidance panel instead of editor
- Imported/generated content hides large guidance; compact collapsible panel remains available
- **Generate Section** remains secondary

Existing **M11 Template Reference** panel (right sidebar) remains available for full read-only template reference.

## Known limitations

- Guidance text is curated from template structure and explicit overrides; not every subsection has page-level PDF line citations yet.
- PDF text was not fully auto-extracted in this pass — overrides reflect key template instructions and scaffolds for remaining leaf sections.
- Foreword (`0.x`) is excluded from the guidance layer (reference panel only).
- Mark Not Applicable inserts plain text; structured “not applicable” metadata export is future work.

## Verification

```bash
npm run build
npm run test:m11-template-guidance
npm run test:authoring
npm run test:protocol-ide-v1
npm run test:protocol-ide-v2
npm run test:protocol-ide-v3-linting
npm run smoke:app-startup
npm run smoke:protocol-import
npm run smoke:interrupted-import
npm run test:parity
npm run validate:protocol
```
