# Protocol IDE v3.1 — Entity-Aware Authoring

Protocol IDE v3.1 upgrades IntelliSense from terminology completion to **protocol-aware entity completion**. The editor reuses entities already present in the Knowledge Graph, Study Model, SoA Knowledge Model, and protocol assets as authoring primitives.

## Entity registry

```
src/app/domain/protocol/entities/
├── protocolEntityTypes.ts
├── protocolEntityRegistry.ts
├── protocolEntityIndex.ts
├── protocolEntitySelectors.ts
├── protocolEntityReference.ts
├── entityCompletionProvider.ts
└── index.ts
```

### Sources

| Source | Entity types |
|--------|----------------|
| Knowledge Graph | objective, endpoint, estimand, population, arm, intervention, assessment, procedure, visit, activity, safetyVariable, statistic |
| Study Model | Same clinical collections mapped to registry types |
| SoA Knowledge | visits, assessments, procedures, activities, timing windows |
| Protocol assets | protocolAsset |
| Canonical Document | section titles (lightweight CDM bridge) |

### Registry entry fields

- `id`, `type`, `name`, `normalizedName`, `aliases`
- `sourceSections`, `references` (related entity IDs)
- `metadata`, `description`, `registrySource`

`buildProtocolEntityRegistry()` merges sources with Knowledge Graph preferred on name collisions.

## Entity-aware IntelliSense

`entityCompletionProvider` integrates with `getProtocolIntellisenseSuggestions()` as the **primary entity source** (replacing duplicate Knowledge Graph provider calls).

### Ranking priority

1. Entities already referenced in the current section
2. Entities linked to the active section (`sourceSections`)
3. Section-type priorities (e.g. Section 8 → assessments/visits)
4. Knowledge Graph registry entries
5. Prefix / partial match strength

### Examples

| Typed | Suggested entity |
|-------|------------------|
| `radi` | Radiographic Progression-Free Survival |
| `overall` | Overall Survival |
| `cycle` | Cycle 1 Day 1, Cycle 2 Day 1 |

## Entity references

Internal model — **visible text unchanged**:

```typescript
ProtocolEntityReference {
  entityId, entityType, displayText,
  sectionId, offset, endOffset, createdAt
}
```

When an entity IntelliSense suggestion is accepted, `recordEntityAcceptance()` stores:

- Section draft: `entityReferences`, `entityInsertionLog`
- localStorage: `m11-protocol-entity-references-v1`, `m11-protocol-entity-insertions-v1`

The editor knows `entityId = endpoint_rpfs` while the user sees **Radiographic Progression-Free Survival**.

## Hover cards

Hovering recognized entity text shows a read-only card (`ProtocolEntityHoverCard`):

- Name, type, definition
- Referenced in (source sections)
- Relationships (from Knowledge Graph)
- **Used by** — sections with references
- **Impacts** — downstream section count from related entities

Terminology hover cards remain as fallback when no entity match exists.

## Related entity suggestions

After accepting an entity suggestion, related entities from Knowledge Graph relationships are offered in the IntelliSense popup (e.g. objective → associated endpoint).

Relationship types used: `has_endpoint`, `has_objective`, `has_assessment`, `measured_by`, `related_to`, etc.

## Consistency awareness

When typed text is a near-duplicate of an existing entity:

```
Progression Free Survival  →  existing: Radiographic Progression-Free Survival
```

IntelliSense shows:

1. **Use existing entity** (default, higher rank)
2. **Create new entity** (lower rank, no auto-replacement)

No automatic text replacement.

## Section-aware entity ranking

| Section | Prioritized types |
|---------|-------------------|
| 3 | objective, endpoint, estimand, population |
| 4 | arm, intervention |
| 5 | population |
| 6 | intervention |
| 8 | assessment, procedure, visit, activity, timingWindow |
| 9 | safetyVariable, assessment |
| 10 | endpoint, estimand, statistic |

## Entity diagnostics

Non-blocking diagnostics (category: `entity`) in the Validation panel:

| Code | Description |
|------|-------------|
| `duplicate_entity_name` | Same normalized name in registry |
| `conflicting_alias` | Alias conflicts with another entity |
| `orphaned_reference` | Reference points to missing entity |
| `unresolved_reference` | Text at reference span changed |

## Audit trail

`EntityInsertionRecord`:

- `id`, `entityId`, `entityType`, `sectionId`, `insertedText`, `timestamp`

Stored locally per section draft and in localStorage. Cleared on workspace reset.

## Tests

```bash
npm run test:protocol-ide-v3-entity-authoring
npm run test:protocol-ide-v3-intellisense
```

## Out of scope (this PR)

- LLM generation
- Git integration
- Collaborative editing
- Visible inline entity tokens (text stays plain)

## Future direction (v3.2)

- Inline entity chip overlays (optional)
- Cross-section entity usage graph panel
- Auto-sync references when entity renamed in Study Model
- Git-backed entity insertion audit export
