# Protocol IDE v1 Architecture

**Status:** Implemented (v1)  
**Scope:** Simplified authoring surface — IDE-oriented editing without Git, AI autocomplete, or collaborative editing  
**Authority:** Evolves [ARCHITECTURE.md](./ARCHITECTURE.md) authoring layer; preserves existing import, validation, and autosave flows

---

## 1. Why M11 Studio is evolving toward a protocol IDE

M11 Studio began as a rich-text document workspace for reviewing imported protocol sections. That model borrowed heavily from word processors: font controls, alignment, and appearance-first tooling that do not help authors write **structured, validated, terminologically controlled** clinical protocol content.

Protocol IDE v1 reframes authoring as **building a regulated document**:

| Word-processor mindset | Protocol IDE mindset |
|------------------------|----------------------|
| Format text | Structure sections |
| Style for print | Validate against M11 rules |
| Free-form vocabulary | Controlled terminology |
| Isolated sections | Dependency-aware entities |
| Find in one file | Search across the protocol |

The goal is not a rewrite. Import, autosave, section validation agents, SoA configuration, and the dependency graph remain. v1 removes distracting formatting chrome and adds IDE primitives: gutter diagnostics, protocol search, status bar metadata, and hooks for future IntelliSense.

---

## 2. Authoring principles

1. **Preserve existing flows** — Manual edit, autosave, validate-section, and import reconstruction behave as before.
2. **Structure over appearance** — Toolbar exposes lists, tables, links, and asset references; not fonts or colors.
3. **Validation is ambient** — The validation sidebar and gutter reflect current section state without requiring a manual run first.
4. **Git-friendly assets** — Figures are referenced by token (`[Figure: …]`), not embedded binary in narrative HTML.
5. **Preview before bulk change** — Find/replace previews diffs; **apply + undo implemented in v2** ([PROTOCOL_IDE_V2_ARCHITECTURE.md](./PROTOCOL_IDE_V2_ARCHITECTURE.md)).
6. **Read-only awareness** — Dependency references show where clinical entities are used; no auto-navigation in v1.

---

## 3. UI composition

```
DocumentViewport (editing)
└── ProtocolIdeEditor
    ├── ProtocolIdeToolbar      Undo/Redo, lists, table, link, image ref, validate, find, replace
    ├── EditorGutter            Optional line numbers; validation/structure/terminology indicators
    ├── RichTextEditor (ideMode, hideToolbar)
    └── SectionEditorStatusBar  Section state, autosave, validation, deps, terminology counts

App shell
├── Protocol Search dialog      Replaces "Quick actions…" command palette for search
├── FindReplacePanel            Preview-only replace scaffold
└── Keyboard shortcuts          Ctrl/Cmd+K/F/H/S via protocolIdeShortcuts.ts

DetailInspector → Validation tab
└── SectionIdeValidationPanel   Structure, terminology, missing content, consistency + Referenced by
```

Dark theme and monospace-friendly editor styling align with VS Code / GitHub Markdown rather than Microsoft Word.

---

## 4. Terminology architecture

**Location:** `src/app/domain/terminology/`

| Type / function | Role |
|-----------------|------|
| `TerminologyEntry` | Normalized codelist term (code, preferred label, ICH label, synonyms) |
| `TerminologyLookupResult` | Match metadata from lookup |
| `findTerm()` | Exact lookup by codelist id/name and code or label |
| `findPreferredTerm()` | Returns ICH-preferred label when known |
| `findSynonyms()` | Synonym labels for a term |
| `searchTerminology()` | Full-text search over loaded M11 JSON |

The service wraps existing `ichM11ControlledTerminology` loaders. When terminology JSON is not ingested, functions return empty results; the architecture remains stable.

**Editor hook:** `getTerminologySuggestions(partial)` in `editorIntegration.ts` — returns ranked suggestions for future tab-completion; no UI in v1.

---

## 5. Validation architecture

**Summary builder:** `buildSectionValidationSummary(sectionId, section, draft, validationIssues)`

Aggregates:

- Structure issues (from draft validation findings)
- Controlled terminology issues
- Missing required content (section status + empty draft)
- Consistency issues
- Global validation issues filtered to the active section

**Gutter:** `buildEditorGutterIndicators(content, summary)` maps summary counts to line-level indicator placeholders.

**Sidebar:** `SectionIdeValidationPanel` shows grouped findings or "Section passes validation" when `summary.passes` is true.

**Toolbar:** Validate Section remains available as an explicit "Run Build" style action (`toolbar-validate-section`).

---

## 6. Dependency architecture

**Function:** `getSectionDependencyReferences(sectionId, document, sections)`

Uses `selectDependencyNodes()` from the knowledge graph and `document.relationships` to list entities anchored in the active section and inbound references ("Referenced by: Section X").

Supported entity families (via clinical design): Objective, Endpoint, Population, Arm, Assessment, Intervention, and related design entities with `sectionRef`.

v1 is **read-only** — no click-to-navigate from the panel.

---

## 7. Search architecture

**Location:** `src/app/domain/protocol/search/`

| Module | Responsibility |
|--------|------------------|
| `protocolSearch.ts` | `searchProtocolContent()` — section-scoped or protocol-wide regex search over drafts + fields |
| `findReplace.ts` | `previewFindReplace()` — non-mutating preview; apply/undo in v2 via `replaceTransaction.ts` |

**UI:** `ProtocolSearchDialog` groups results by section; selecting a result sets `selectedSectionId` and `highlightQuery` for in-editor highlighting.

**Shortcuts:** `resolveProtocolIdeShortcut()` maps Ctrl/Cmd+K (toggle search), +F (find/search), +H (replace panel), +S (force save).

---

## 8. Image reference model

**Location:** `src/app/domain/protocol/assets/protocolAssetReference.ts`

```typescript
interface ProtocolAssetReference {
  id: string;
  type: 'figure' | 'table-image' | 'diagram' | 'attachment';
  name: string;
  caption: string;
  storageLocation: string;  // Git-friendly path, no binary in text
  createdAt: string;
}
```

Insert action writes `[Figure: {caption}](asset:{id})` into narrative text. Persisted assets live in `protocolAssetRegistry.ts` (v2).

---

## 9. v2 capabilities (see PROTOCOL_IDE_V2_ARCHITECTURE.md)

Implemented in v2: line diagnostics, IntelliSense popup, transactional replace/undo, asset registry, figure placeholder cards.

Remaining for v3+: entity-aware completions from the dependency graph, Git amendment diff, collaborative cursors.

---

## 10. Known limitations (v1 baseline)

- Find/replace **apply** moved to v2 (`replaceTransaction.ts`).
- Gutter line precision moved to v2 (`lineDiagnostics.ts`).
- Undo/redo rely on browser `document.execCommand` for contentEditable.
- Ctrl/Cmd+F opens Protocol Search (find), not the separate FindReplacePanel.
- Export action removed from the old quick-actions palette (can be restored in Protocol Search v2).
- Terminology suggestions require ingested M11 terminology JSON.

---

## 11. Recommended Protocol IDE v2 direction

1. **Precise diagnostics** — Map validation findings to line/column in gutter and inline squiggles.
2. **Apply find/replace** — Transactional multi-section replace with undo stack integration.
3. **IntelliSense UI** — Popup wired to `getTerminologySuggestions()` with codelist context.
4. **Asset registry** — Persist `ProtocolAssetReference` records alongside protocol version; render thumbnails in viewport.
5. **Git integration** — Diff narrative sections and asset paths per amendment.
6. **Collaborative cursors** — Optional; out of scope until authoring surface is stable.

---

## 12. Verification

Run:

```bash
npm run build
npm run test:protocol-ide-v1
npm run test:authoring
npm run test:rich-text-editor
npm run test:agents
npm run test:soa-agent
npm run test:soa-enrichment
npm run test:soa-knowledge
npm run smoke:app-startup
npm run smoke:protocol-import
npm run smoke:interrupted-import
npm run test:parity
npm run validate:protocol
```
