-- M11 Studio — knowledge graph tables (architecture scaffold)
-- DO NOT execute automatically from the app. Apply manually via Supabase CLI or dashboard.
-- See SUPABASE_ARCHITECTURE.md and KNOWLEDGE_GRAPH_ARCHITECTURE.md.

-- ---------------------------------------------------------------------------
-- knowledge_entities
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_entities (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid references public.protocols (id) on delete cascade,
  entity_type text not null,
  name text not null,
  normalized_name text not null,
  description text,
  aliases jsonb not null default '[]'::jsonb,
  source_section_ids jsonb not null default '[]'::jsonb,
  source_document_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_entities_protocol_id_idx on public.knowledge_entities (protocol_id);
create index if not exists knowledge_entities_entity_type_idx on public.knowledge_entities (entity_type);
create index if not exists knowledge_entities_normalized_name_idx on public.knowledge_entities (normalized_name);
create unique index if not exists knowledge_entities_protocol_type_name_idx
  on public.knowledge_entities (protocol_id, entity_type, normalized_name);

-- ---------------------------------------------------------------------------
-- knowledge_relationships
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_relationships (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid references public.protocols (id) on delete cascade,
  source_entity_id uuid not null references public.knowledge_entities (id) on delete cascade,
  target_entity_id uuid not null references public.knowledge_entities (id) on delete cascade,
  relationship_type text not null,
  source_section_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_relationships_protocol_id_idx on public.knowledge_relationships (protocol_id);
create index if not exists knowledge_relationships_relationship_type_idx on public.knowledge_relationships (relationship_type);
create index if not exists knowledge_relationships_source_entity_id_idx on public.knowledge_relationships (source_entity_id);
create index if not exists knowledge_relationships_target_entity_id_idx on public.knowledge_relationships (target_entity_id);
create unique index if not exists knowledge_relationships_unique_edge_idx
  on public.knowledge_relationships (protocol_id, source_entity_id, target_entity_id, relationship_type);
