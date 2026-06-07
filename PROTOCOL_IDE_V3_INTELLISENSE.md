# Protocol IDE v3 — IntelliSense Foundation

Protocol IDE v3 adds protocol-aware IntelliSense to M11 Studio’s authoring environment. The editor helps authors write valid M11 protocol text in real time using controlled terminology, Knowledge Graph entities, section context, and deterministic ghost text scaffolds.

## Architecture

```
src/app/domain/protocol/authoring/intellisense/
├── intellisenseTypes.ts          # Suggestion, context, acceptance record types
├── intellisenseProvider.ts       # Unified getProtocolIntellisenseSuggestions()
├── terminologyCompletionProvider.ts
├── knowledgeGraphCompletionProvider.ts
├── sectionContextCompletionProvider.ts
├── ghostTextProvider.ts
├── intellisenseRanking.ts        # Rank + dedupe
├── intellisenseAcceptanceStore.ts
├── textRange.ts                  # Token/phrase ranges + replacement
└── index.ts
```

### Unified provider

`getProtocolIntellisenseSuggestions(context)` calls all completion providers, applies section-context score boosts, ranks and deduplicates results, and returns up to **8** popup suggestions plus an optional ghost text suggestion.

Context includes:

- `sectionId`, `sectionTitle`, `currentText`, `cursorOffset`
- `currentToken`, `currentLine`, `nearbyText`
- Optional `knowledgeGraph`, `studyModel`, `soaKnowledge`
- `trigger`: `typing` | `explicit` | `tab` | `hover`

## Terminology suggestions

Uses the existing M11 controlled terminology service (Protocol IDE v1/v2).

| Behavior | Example |
|----------|---------|
| Partial preferred term (2+ chars) | `phase` → Phase I/II/III Trial terms |
| Synonym → preferred term | Non-preferred wording surfaced with `kind: synonym` |
| Detail metadata | Codelist name, code, definition when available |

**Acceptance:** Tab or click replaces text and records acceptance metadata (original text, inserted text, code, codelist, section id, timestamp).

## Knowledge Graph suggestions

Suggests entities from the Knowledge Graph when the user types 2+ characters:

- Objectives, endpoints, estimands, populations
- Arms, interventions, assessments, procedures, visits
- SoA-related terms

Example: if the graph contains endpoint `rPFS`, typing `radio…` suggests **radiographic progression-free survival**.

Suggestion detail shows entity type and source sections.

## Section-context suggestions

Suggestions are boosted by active M11 section:

| Section | Focus |
|---------|-------|
| 3 | Objectives, endpoints, estimands, population |
| 4 | Design, arms, randomization, blinding |
| 5 | Population, inclusion/exclusion criteria |
| 6 | Interventions, dosing, administration |
| 8 | Assessments, procedures, visits, SoA |
| 9 | Adverse events, safety monitoring |
| 10 | Endpoints, estimands, analysis sets, statistics |

Study Model items in matching collections are also suggested.

## Ghost text scaffold

Lightweight, **deterministic** phrase completion (no LLM).

Templates match high-confidence line prefixes, for example:

```
The primary objective of this trial is|
→ to evaluate [primary endpoint] in [population].
```

Ghost text is shown only when confidence ≥ **0.85** and no popup suggestions are active.

| Key | Action |
|-----|--------|
| Tab | Insert ghost text |
| Escape | Dismiss ghost hint |

## Replacement ranges

| Case | Behavior |
|------|----------|
| Token completion | Replaces current token only |
| Multi-word synonym | Replaces full phrase (e.g. `investigational product` → `investigational trial intervention`) |

Implemented via `replacementRange` on `ProtocolIntellisenseSuggestion` and `applyIntellisenseSuggestion()`.

## Editor UI

Wired into `RichTextEditor` (IDE mode) via `ProtocolIntellisensePopup`:

- Popup near cursor, dark theme
- Max 8 suggestions with kind icon, label, detail, description
- **ArrowUp / ArrowDown** — navigate
- **Enter / Tab** — accept selected suggestion
- **Escape** — close popup / dismiss ghost text
- Click — accept suggestion
- Does not auto-insert; normal typing is preserved

Diagnostic navigation: clicking a line diagnostic with a suggested fix scrolls to the line and opens IntelliSense with `trigger: explicit`.

## Validation integration

When a terminology diagnostic includes `suggestedFix`, navigating to that diagnostic opens IntelliSense via `findIntellisenseSuggestionForFix()`. Accepting a terminology/synonym suggestion records acceptance and updates the draft audit log, which can reduce repeated terminology warnings on re-validation.

## Acceptance audit trail

`IntellisenseAcceptanceRecord` fields:

- `id`, `sectionId`, `suggestionId`, `kind`, `source`
- `originalText`, `insertedText`, `timestamp`, `metadata`

Stored locally in:

- `localStorage` key `m11-intellisense-acceptance-v1`
- Section draft field `intellisenseAcceptanceLog`

Terminology acceptances also flow to the existing `terminologyAcceptanceLog`. Cleared on workspace/project reset.

## Tests

```bash
npm run test:protocol-ide-v3-intellisense
```

Covers terminology partial match, synonym handling, Knowledge Graph entities, section prioritization, dedupe/ranking, replacement ranges, ghost text confidence, acceptance storage, and diagnostic fix matching.

## Future AI completion path (v3.1 / v4)

| v3 (this PR) | Future |
|--------------|--------|
| Deterministic ghost text | LLM phrase completion with guardrails |
| Local acceptance log | Git/Supabase persistence |
| Popup IntelliSense | Inline Copilot-style completions |
| Section heuristics | Embedding-based context ranking |

Recommended v3.1: wire acceptance log to export bundles; v4: optional AI provider behind explicit user trigger with terminology/KG grounding.

## Out of scope (this PR)

- Git repository layer
- Collaborative editing
- Full AI/Copilot generation
- Auto-insert without user action
- Supabase credentials
