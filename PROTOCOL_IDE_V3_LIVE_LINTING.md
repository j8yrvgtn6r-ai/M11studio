# Protocol IDE v3.2 — Live Protocol Linting

Protocol IDE v3.2 adds continuous, non-blocking protocol linting to M11 Studio. As authors write protocol text, the IDE surfaces terminology, structure, consistency, and SoA issues in near real time—similar to VS Code, TypeScript, and ESLint—without blocking typing, exiting edit mode, or auto-applying fixes.

## Architecture

```
src/app/domain/protocol/authoring/linting/
├── protocolLintTypes.ts       # Issue, quick fix, scheduler, summary types
├── protocolLintEngine.ts      # runProtocolLint, merge/dedupe, quick fix apply
├── protocolLintRules.ts       # Orchestrator + style/grammar scaffold rules
├── terminologyLintRules.ts    # M11 synonym / non-preferred term detection
├── structureLintRules.ts      # Required content, placeholders, thin sections
├── consistencyLintRules.ts    # KG / Study Model cross-reference checks
├── soaLintRules.ts              # SoA Knowledge narrative alignment
├── protocolLintStore.ts       # Session-scoped in-memory issue store
├── protocolLintScheduler.ts   # Debounced background lint jobs
├── useProtocolLint.ts           # React hook for editor integration
└── index.ts
```

### Data flow

1. Author types in `ProtocolIdeEditor`.
2. `useProtocolLint` schedules lint via `scheduleSectionLint` (650 ms debounce).
3. `runProtocolLint` runs deterministic rule groups against plain text.
4. Issues land in `protocolLintStore` and merge with validation diagnostics.
5. UI reads merged diagnostics for gutter markers, inline squiggles, validation panel, and status bar.

Lint is **read-only**: it never mutates protocol content, workflow state, or autosave by itself.

## ProtocolLintIssue

| Field | Purpose |
|-------|---------|
| `id` | Stable issue identifier |
| `sectionId` | Section where issue was detected |
| `lineNumber`, `startOffset`, `endOffset` | Optional range for gutter/squiggles |
| `severity` | `info` \| `warning` \| `error` |
| `category` | `terminology`, `structure`, `requiredContent`, `consistency`, `soa`, `grammar`, `style` |
| `message` | Human-readable description |
| `suggestedFix` | Optional preferred replacement or navigation hint |
| `source` | `terminology`, `m11Template`, `knowledgeGraph`, `studyModel`, `soaKnowledge`, `validationAgent`, `localRule` |
| `relatedEntityIds`, `relatedSectionIds` | Cross-reference metadata |
| `createdAt` | ISO timestamp |

## Lint categories

### Terminology

Detects known synonyms and non-preferred terms; suggests preferred M11 wording.

Examples:

- `subject` → `participant`
- `investigational product` → `investigational trial intervention`
- `this study` → `this trial` (contextual info)

Integrates with IntelliSense and terminology acceptance when the user applies a quick fix.

### Structure

- Missing required section content
- Placeholder / instruction text still present (`[Insert …]`, `TBD`, `TODO`)
- Overly thin narrative (< 40 characters)

### Consistency

Uses Knowledge Graph and Study Model:

- Endpoint mentioned but not defined
- Objectives without endpoints in KG (Section 3)
- Intervention mentioned without intervention entities
- Cross-section references to undefined entities

### SoA

Uses SoA Knowledge:

- Assessment mentioned in narrative but not scheduled
- Visit timing referenced but absent from SoA Knowledge
- Scheduled assessment not described in Section 8 narrative

### Style / grammar scaffold

Lightweight local rules (no heavy grammar engine):

- Overly long sentences (> 45 words)
- Repeated whitespace
- Double punctuation
- Placeholder markers (`TBD`, `TODO`, `[insert]`)

## Scheduler behavior

`protocolLintScheduler.ts` implements debounced background linting:

| State | Meaning |
|-------|---------|
| `idle` | No pending work |
| `scheduled` | Debounce timer active |
| `running` | Lint executing |
| `complete` | Issues stored |
| `failed` | Error logged to console; editor remains usable |

Behavior:

- Debounce: **650 ms** idle after typing (`LINT_DEBOUNCE_MS`)
- Cancel/restart when user continues typing
- Lint current section first
- Background lint for impacted sections via `scheduleImpactedSectionLint` (800 ms+ debounce)
- Wired from `applyConsistencyAgentResults` when consistency agent marks impacted sections
- Never blocks typing, never exits edit mode, never triggers autosave

Status bar labels:

- `Linting…` — scheduled or running
- `3 issues` — completed with findings
- `No issues` — completed clean

## Quick fixes

`ProtocolQuickFix` model:

| Field | Purpose |
|-------|---------|
| `id`, `label`, `issueId` | Identity and UI label |
| `replacementText`, `range` | For text replacement fixes |
| `actionType` | `replaceText`, `openIntellisense`, `openValidation`, `navigateSection`, `runSoAAgent`, `none` |

Behavior:

- **Terminology**: quick fix replaces with preferred term; records IntelliSense + terminology acceptance on user click
- **Consistency**: may navigate to related section or open Review Impact
- **No auto-apply** — fixes run only when the user clicks a quick fix button

## Editor integration

`ProtocolIdeEditor`:

- Schedules lint on every text change
- Merges live lint with validation diagnostics (deduped)
- Passes merged diagnostics to gutter, squiggles, and validation panel
- Registers quick fix handler via `registerProtocolQuickFixHandler`
- Shows lint status in `SectionEditorStatusBar`

Dedupe key: `sectionId + category + normalized message + range`

Lint diagnostics use source prefix `liveLint:…` to distinguish from validation findings.

## Validation panel

Right **Validation** tab shows:

- Live linting issues grouped by category
- Severity icons
- Quick fix buttons where available
- `Last linted [time]`

Empty state: **Live linting found no issues.**

## Workflow state separation

Linting does **not** change workflow state by itself. It may influence display summaries (e.g. “Draft with warnings”) but must not convert:

- Draft → Pending Validation
- Required Missing → Draft
- Validated → invalid

Workflow transitions remain explicit user or agent actions.

## Performance guardrails

| Guardrail | Value / behavior |
|-----------|------------------|
| Debounce | 650 ms (current section) |
| Max text length | 100,000 characters — skip/truncate gracefully |
| Max runtime | 2,000 ms — cap issue count |
| Mutations | None on protocol content |
| Failures | Logged to console; no blank-screen |

## Future: LLM / grammar integration

v3.2 intentionally uses deterministic rules only. Future versions can add:

- LLM-assisted grammar and clarity suggestions (opt-in, async)
- LanguageTool or similar grammar service behind a provider interface
- Agent-backed consistency checks merged into the same `ProtocolLintIssue` model
- Persistent lint history and cross-session issue tracking

Recommended path for **IDE v3.3**: entity-aware lint (link issues to protocol entity registry hover cards).

Recommended path for **IDE v4**: unified diagnostics hub combining validation agent output, live lint, and SoA agent proposals with shared quick-fix actions.

## Verification

```bash
npm run test:protocol-ide-v3-linting
```

See also the full Protocol IDE verification suite in the project README / build scripts.
