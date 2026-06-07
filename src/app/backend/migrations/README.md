# M11 Studio Supabase Migrations

Migration SQL files in this folder are **generated for review and manual application only**.

The M11 Studio app does **not** execute migrations automatically.

## Apply manually

Using Supabase CLI (recommended):

```bash
supabase db push
# or
psql "$DATABASE_URL" -f src/app/backend/migrations/001_initial_schema.sql
```

Using the Supabase dashboard SQL editor: paste and run `001_initial_schema.sql`.

## Ordering

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Core tables for protocols, sections, study models, knowledge, versions, agents, validation, source documents |
| `002_knowledge_graph.sql` | Knowledge graph entities and relationships (apply after 001) |
| `003_soa_knowledge.sql` | SoA Knowledge Model tables — models, entities, schedule rules (apply after 001) |
