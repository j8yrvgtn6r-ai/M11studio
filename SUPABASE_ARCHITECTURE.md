# Supabase Backend Architecture — M11 Studio

Architecture and persistence scaffold for moving durable protocol data from browser-only storage to Supabase/Postgres. **This PR does not migrate workflows, wire the UI, or add authentication.**

## Current State

Today, M11 Studio persists working state in the browser:

| Concern | Location |
|--------|----------|
| Import drafts & workflow | `localStorage` (`protocolImportStore`) |
| Large section bodies | IndexedDB |
| Study model, build console | React stores + in-memory events |
| LLM / UI settings | `localStorage` |
| Seed protocol JSON | Bundled fixtures + domain selectors |

The UI reads and writes these stores directly. Agents (e.g. Knowledge Agent v1) emit in-memory events and patch the study model store.

## Future State

```
Frontend (React)
       ↓
Repository Layer (src/app/backend/repositories/)
       ↓
StorageProvider (browser default → Supabase opt-in)
       ↓
Supabase Client (lazy, env-driven)
       ↓
Postgres
```

Goals:

- Durable home for protocols, sections, study models, knowledge layers, agent events, validation runs, versions, and source documents
- Gradual migration without breaking existing browser workflows
- Agent results and events persisted for audit and replay
- Auth, orgs, and RBAC added in a later phase

## Directory Layout

```
src/app/backend/
├── supabaseClient.ts          # Lazy client, graceful when unconfigured
├── types/                     # Row / insert / update TypeScript types
├── migrations/                # SQL only — not auto-applied
├── repositories/              # Pure CRUD repositories
├── storage/                   # Browser vs Supabase provider selection
├── agents/                    # Agent persistence interfaces (not wired)
└── index.ts                   # Public exports
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

When either is missing:

- `isSupabaseConfigured()` returns `false`
- `getSupabaseClient()` returns `null`
- Repositories throw `RepositoryUnavailableError` if invoked
- The app continues using browser storage (no crash)

Auth is intentionally disabled on the client (`persistSession: false`).

## Schema

Migration file: `src/app/backend/migrations/001_initial_schema.sql`

Knowledge graph migration: `src/app/backend/migrations/002_knowledge_graph.sql` (apply after 001)

### Tables

| Table | Purpose |
|-------|---------|
| `protocols` | Top-level protocol record, status, `current_version_id`, metadata |
| `protocol_sections` | Section content, workflow state, source type |
| `core_study_models` | Versioned study model JSONB snapshots |
| `knowledge_layers` | Versioned knowledge layer JSONB |
| `protocol_versions` | Commit-style version history |
| `agent_events` | Agent build-console / audit events |
| `validation_runs` | Section or protocol validation results |
| `source_documents` | Imported DOCX metadata and storage paths |
| `knowledge_entities` | Structured study entities (objectives, endpoints, …) |
| `knowledge_relationships` | Directed relationships between entities |

`knowledge_entities` columns: `protocol_id`, `entity_type`, `name`, `normalized_name`, `description`, `aliases`, `source_section_ids`, `source_document_ids`, `metadata`, timestamps.

`knowledge_relationships` columns: `protocol_id`, `source_entity_id`, `target_entity_id`, `relationship_type`, `source_section_ids`, `metadata`, timestamps.

Indexes on `protocol_id`, `entity_type`, `normalized_name`, `relationship_type`, `source_entity_id`, `target_entity_id`. Unique constraints on `(protocol_id, entity_type, normalized_name)` and relationship edges.

See `KNOWLEDGE_GRAPH_ARCHITECTURE.md` for domain semantics and agent usage.

All tables use UUID primary keys (`gen_random_uuid()`), `created_at` timestamps, and JSONB where flexible payloads are needed. `protocol_sections` and versioned tables are indexed by `protocol_id`.

### Applying migrations

**Do not run migrations from the app.** Apply manually:

1. Supabase Dashboard → SQL Editor → paste `001_initial_schema.sql`, then `002_knowledge_graph.sql`
2. Or Supabase CLI: `supabase db push` after linking the project

See `src/app/backend/migrations/README.md` for step-by-step notes.

### Auth / RLS (TODO)

This scaffold leaves RLS disabled. Before production:

- Add Supabase Auth (users, orgs)
- Enable RLS on all tables
- Policies scoped by `organization_id` / `created_by`
- Service role for server-side jobs only

## Repository Pattern

Each repository exposes pure persistence — no business logic:

- `getById(id)`
- `list(filters?)`
- `create(input)`
- `update(id, input)`
- `delete(id)`

| Repository | Table |
|--------------|-------|
| `ProtocolRepository` | `protocols` |
| `ProtocolSectionRepository` | `protocol_sections` |
| `CoreStudyModelRepository` | `core_study_models` |
| `KnowledgeLayerRepository` | `knowledge_layers` |
| `KnowledgeEntityRepository` | `knowledge_entities` |
| `KnowledgeRelationshipRepository` | `knowledge_relationships` |
| `KnowledgeGraphRepository` | composite load/save over entity + relationship repos |
| `ProtocolVersionRepository` | `protocol_versions` |
| `AgentEventRepository` | `agent_events` |
| `ValidationRepository` | `validation_runs` |
| `SourceDocumentRepository` | `source_documents` |

Errors:

- `RepositoryUnavailableError` — Supabase not configured
- `RepositoryPersistenceError` — Supabase API error

## Storage Providers

| Provider | Default | Behavior |
|----------|---------|----------|
| `BrowserStorageProvider` | **Yes** | `getSupabaseBackend()` returns `null`; existing localStorage/IndexedDB unchanged |
| `SupabaseStorageProvider` | No | Returns repository bundle when env vars are set |

Registry:

- `getStorageProvider()` — returns active provider (browser)
- `setStorageProvider()` — for future migration tooling/tests only

No UI or store imports the registry in this PR.

## Migration Strategy

Phased approach — **no data migration in this PR**:

1. **Foundation (this PR)** — schema SQL, types, repositories, providers, docs
2. **Dual-write (future)** — optional shadow writes to Supabase while UI still reads browser storage
3. **Read switch (future)** — repositories become source of truth per entity type
4. **Browser deprecation (future)** — remove legacy keys after parity validation
5. **Auth (future)** — users, orgs, RLS before multi-tenant production

Import flow mapping (future):

- DOCX → `source_documents` + Supabase Storage bucket
- Structural mapping → `protocol_sections` with `workflow_state`
- Study model build → `core_study_models` version rows
- Knowledge Agent → `knowledge_layers` + `knowledge_entities` / `knowledge_relationships` + `agent_events`

## Agent Persistence Strategy

Interfaces in `src/app/backend/agents/` define future ports:

| Agent | Port | Persists |
|-------|------|----------|
| Knowledge | `KnowledgeAgentPersistence` | Events, knowledge layer versions, optional version commits |
| Consistency | `ConsistencyAgentPersistence` | Events, validation-related metadata |
| Validation | `ValidationAgentPersistence` | `validation_runs`, section state |
| Generation | `GenerationAgentPersistence` | Section content updates, version commits |
| Structural Mapping | `StructuralMappingAgentPersistence` | Imported sections, mapping metadata |

Shared `AgentPersistencePort` methods (not implemented yet):

- `persistResult()` — summary of agent run
- `persistEvents()` — map to `agent_events` rows
- `persistKnowledgeLayerUpdate()` — append `knowledge_layers` version
- `persistProtocolVersion()` — append `protocol_versions` row

Runtime agents in `src/app/agents/` remain unchanged; a future adapter will translate `AgentResult` / `AgentEvent` to repository inserts.

## Knowledge Layer Persistence Strategy

Browser today: knowledge patches applied in-memory via Knowledge Agent → study model store + knowledge graph store (`localStorage` fallback).

Future:

1. Each agent run that produces knowledge graph patches upserts `knowledge_entities` / `knowledge_relationships`
2. Each agent run that produces study/knowledge JSON may also append `knowledge_layers` version rows
2. `protocols.current_version_id` may reference the latest committed snapshot (via `protocol_versions`)
3. Read path: latest `knowledge_layers` by `(protocol_id, version desc)`
4. Full JSONB stored for replay; diffing optional in application layer

## Versioning Strategy

Two complementary mechanisms:

1. **`protocol_versions`** — user- or agent-initiated commits (`commit_message`, `commit_source`, metadata)
2. **`core_study_models` / `knowledge_layers`** — numeric version columns for model and knowledge snapshots

Workflow (future):

- Import complete → initial version row
- Section validated / generation batch → version commit
- `protocols.current_version_id` updated on explicit save or publish
- History UI reads `protocol_versions` ordered by `created_at desc`

## What This PR Does Not Do

- No visual graph UI
- No auth, organizations, or RBAC
- No automatic migration execution
- No dual-write or read switch to Supabase for runtime graph queries

## Verification

After scaffold changes, run:

```bash
npm run build
npm run test:agents
npm run smoke:protocol-import
npm run smoke:app-startup
npm run smoke:interrupted-import
npm run test:parity
npm run validate:protocol
```

All existing workflows must pass unchanged.
