# Protocol IDE v2 Architecture

**Status:** Implemented (v2)  
**Scope:** Line-level validation, controlled terminology IntelliSense, transactional find/replace, persisted asset registry  
**Builds on:** [PROTOCOL_IDE_V1_ARCHITECTURE.md](./PROTOCOL_IDE_V1_ARCHITECTURE.md)

---

## 1. Goals

Protocol IDE v2 upgrades v1 from section-level awareness to **line-precise authoring support**:

| v1 | v2 |
|----|-----|
| Section-level gutter markers | Line-aware diagnostics and gutter dots |
| Preview-only find/replace | Transactional replace with undo |
| Terminology hook only | IntelliSense popup + hover cards |
| Inline figure tokens | Asset registry + read-only figure cards |

**Explicitly out of scope:** Git provider integration, collaborative editing, full amendment diff workflow, Supabase credentials.

---

## 2. Line diagnostics

**Module:** `src/app/domain/protocol/authoring/lineDiagnostics.ts`

### Model: `LineDiagnostic`

| Field | Purpose |
|-------|---------|
| `id` | Stable diagnostic id |
| `sectionId` | Owning M11 section |
| `lineNumber` | 1-based line in plain text |
| `startOffset` / `endOffset` | Optional character span |
| `severity` | `info` \| `warning` \| `error` |
| `category` | `structure`, `terminology`, `consistency`, `missingContent`, `grammar`, `soa` |
| `message` | User-facing explanation |
| `source` | e.g. `validation`, `M11 terminology`, `terminologySuggestionAccepted` |
| `suggestedFix` | Optional replacement text |
| `relatedEntityIds` / `relatedSectionIds` | Optional graph links |

### Mapping strategy (best effort)

1. Use `ValidationChange.startIndex` / `endIndex` when present.
2. Else text-search `originalText`, `suggestedTerm`, or issue message in plain content.
3. Else fall back to line 1 / section-level indicator.

`buildLineDiagnostics()` aggregates protocol validation issues, draft findings, validation changes, and terminology acceptance log entries.

---

## 3. Gutter and inline highlights

### Gutter (`EditorGutter.tsx`)

- Line numbers shown by default in edit mode.
- Colored dot per affected line (error/warning/info).
- Hover shows diagnostic message.
- Click scrolls to `startOffset` when available.

### Inline squiggles (`diagnosticHighlights.ts`)

When unfocused, diagnostics with spans render as subtle `protocol-diagnostic-*` spans. Highlights strip on focus/edit. Hover shows issue type, explanation, suggested fix, and source.

---

## 4. Controlled terminology IntelliSense

**Modules:** `editorIntegration.ts`, `terminologyEditorIntegration.ts`, `RichTextEditor.tsx`

- Trigger: ≥2 characters; token matches preferred term or synonym.
- Tab accepts preferred term; provenance stored in `terminologyAcceptanceLog`.
- Hover cards show term metadata or suggested M11 term for synonyms.

---

## 5. Transactional find/replace

**Module:** `src/app/domain/protocol/search/replaceTransaction.ts`  
**Storage:** `m11-replace-transactions-v1`

Preview with per-match checkboxes → **Apply Selected** creates one transaction with section snapshots → **Undo Last Replace** restores snapshots and re-runs Knowledge/Consistency agents.

`FindReplacePanel` groups preview by section and warns before cross-section apply.

---

## 6. Asset registry

**Module:** `src/app/domain/protocol/assets/protocolAssetRegistry.ts`  
**Storage:** `m11-protocol-assets-v1`

Token format: `[Figure: Caption](asset:id)`. Insert dialog creates or links registry entries without embedding binary. Read-only view renders `FigureReferenceCard` placeholders with optional thumbnails.

---

## 7. Reset integration

| Action | Replace transactions | All assets | Imported assets |
|--------|---------------------|------------|-----------------|
| `resetProject()` | Cleared | Cleared | Cleared |
| `resetImportWorkspace()` | Cleared | Preserved | Cleared |

---

## 8. Validation panel

`SectionIdeValidationPanel` lists line diagnostics, terminology items, and accepted terms. Click navigates via `DiagnosticScrollTarget` from App → DocumentViewport → ProtocolIdeEditor.

---

## 9. Future directions

- **Git diff (v3+):** Amendment view using replace transactions and asset registry metadata.
- **Collaborative cursor (v3+):** Shared diagnostics and OT on plain-text layer.

---

## 10. Verification

```bash
npm run build
npm run test:protocol-ide-v1
npm run test:protocol-ide-v2
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

---

## 11. Known limitations (v2)

- Line mapping is best-effort; not all findings include character spans.
- Replace applies only where section drafts exist.
- IntelliSense/hover use browser selection APIs.
- Asset registry is local-only; no remote binary upload.
- Knowledge Agent scheduling is debounced (500ms).
