# Knowledge Graph Architecture — M11 Studio

Structured study knowledge as a persistable, queryable data graph. This is a **data architecture** layer — not a visual graph UI.

## Study Model vs Knowledge Graph

| Layer | Purpose | Shape |
|-------|---------|-------|
| **Study Model** | Section-linked collections of study facts for authoring UI | Arrays keyed by collection (`objectives`, `endpoints`, …) |
| **Knowledge Graph** | Entity–relationship graph for agent queries | Typed entities + directed relationships |

The Study Model answers: *“What structured facts were extracted, and from which sections?”*

The Knowledge Graph answers: *“What depends on rPFS?”* without rereading protocol text.

```
Section text
    → Knowledge Agent
        → Study Model patch (collections)
        → Knowledge Graph patch (entities + relationships)
    → Consistency Agent (optional graph-augmented section impacts)
```

## Domain Layer

Location: `src/app/domain/knowledge-graph/`

| File | Role |
|------|------|
| `knowledgeGraphTypes.ts` | Entity, relationship, graph, patch types |
| `knowledgeGraphStore.ts` | In-memory + localStorage store, subscribe/patch/rebuild |
| `knowledgeGraphBuilder.ts` | `buildKnowledgeGraphFromStudyModel()` |
| `knowledgeGraphPatch.ts` | Upsert/merge patch semantics |
| `knowledgeGraphSelectors.ts` | Pure graph filtering |
| `knowledgeGraphQueries.ts` | Agent-facing query helpers |
| `knowledgeGraphExtraction.ts` | Section-level entity/relationship extraction |
| `useKnowledgeGraph.ts` | React summary hook for drawer UI |

## Entity Types

`study`, `objective`, `endpoint`, `estimand`, `population`, `arm`, `intervention`, `visit`, `activity`, `assessment`, `procedure`, `safetyVariable`, `statisticalMethod`, `eligibilityCriterion`, `terminologyTerm`, `documentSection`, `sourceDocument`, `other`

Unknown types from external input are coerced to `other`.

## Relationship Types

`depends_on`, `measured_by`, `evaluated_in`, `belongs_to`, `supports`, `derived_from`, `requires`, `described_in`, `scheduled_at`, `uses`, `has_endpoint`, `has_objective`, `has_intervention`, `has_assessment`, `has_population`, `has_statistical_method`, `related_to`

Unknown relationship types are coerced to `related_to`.

## Patch Semantics

- Upsert entities by `(entityType, normalizedName)`
- Merge aliases and `sourceSectionIds`
- Dedupe relationships by `(sourceEntityId, targetEntityId, relationshipType)`
- Never wipe unrelated graph data
- Never create empty-name entities

## Query Helpers

For agents and future UI:

- `getKnowledgeEntitiesByType(type)`
- `findKnowledgeEntityByName(type, name)`
- `getRelationshipsForEntity(entityId)`
- `getEntitiesDependingOn(entityId)`
- `getEntitiesMeasuredBy(endpointId)`
- `getSectionsReferencingEntity(entityId)`
- `getAffectedSectionsForEntity(entityId)`
- `getKnowledgeGraphSummary()`

## Agent Usage

### Knowledge Agent v1 (upgraded)

Flow:

```
Section → extract facts → patch Study Model
       → extract KnowledgeEntities
       → extract KnowledgeRelationships
       → patch KnowledgeGraph
```

`KnowledgeAgentOutput` includes `knowledgeEntities[]`, `knowledgeRelationships[]`, plus existing study model fields.

Build console events (aggregated):

- Knowledge Graph update started
- N entities extracted
- Y relationships extracted
- Knowledge Graph updated

### Consistency Agent v1 (optional graph)

Deterministic M11 dependency rules remain primary. When the Knowledge Graph has matching relationships, section impacts are augmented with graph-linked sections.

Console notes:

- `Consistency Agent used Knowledge Graph relationships` — graph contributed section IDs
- `Consistency Agent used deterministic dependency rules` — graph empty or no matches
- `Knowledge Graph query used by Consistency Agent` — graph query ran

Graph is **not required** — agents fall back safely.

## Persistence Paths

### Local fallback (default)

- `BrowserStorageProvider` remains default
- Graph stored in `knowledgeGraphStore` (memory + `localStorage` key `m11-knowledge-graph-v1`)
- No Supabase credentials required
- Rebuilt/merged when Study Model rebuilds or Knowledge Agent patches

### Supabase path (scaffold)

Migration: `src/app/backend/migrations/002_knowledge_graph.sql`

Tables:

- `knowledge_entities`
- `knowledge_relationships`

Repositories:

- `KnowledgeEntityRepository`
- `KnowledgeRelationshipRepository`
- `KnowledgeGraphRepository` (load/save helpers)

Not wired to UI yet — future dual-write/read switch follows `SUPABASE_ARCHITECTURE.md` phased migration.

## UI (v1)

Small summary card in Study Model drawer:

- Entities count
- Relationships count
- Last updated time

No visual graph rendering in v1.

## Future Integration

- Visual dependency graph in build console / explorer
- Graph-driven scheduling and validation targets
- Supabase dual-write from Knowledge Agent runs
- Cross-protocol terminology linking via `terminologyTerm` entities

## Verification

```bash
npm run build
npm run test:agents
npm run test:backend
npm run smoke:protocol-import
npm run smoke:app-startup
npm run smoke:interrupted-import
npm run test:parity
npm run validate:protocol
```

## Known Limitations (v1)

- Relationship inference from Study Model is conservative; weak name matches are not linked
- Supabase repositories are scaffold-only — local store is authoritative at runtime
- No auth/RLS on graph tables yet
- Graph does not replace Study Model collections in UI
- Section-level extraction creates relationships only when co-located facts appear in the same section pass
