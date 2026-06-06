-- M11 Studio — initial Supabase schema (architecture scaffold)
-- DO NOT execute automatically from the app. Apply manually via Supabase CLI or dashboard.
-- See SUPABASE_ARCHITECTURE.md for migration strategy.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- protocols
-- ---------------------------------------------------------------------------
create table if not exists public.protocols (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  current_version_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists protocols_status_idx on public.protocols (status);
create index if not exists protocols_updated_at_idx on public.protocols (updated_at desc);

-- ---------------------------------------------------------------------------
-- protocol_sections
-- ---------------------------------------------------------------------------
create table if not exists public.protocol_sections (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols (id) on delete cascade,
  section_id text not null,
  section_title text not null,
  content text not null default '',
  workflow_state text not null default 'needsGeneration',
  source_type text not null default 'imported',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (protocol_id, section_id)
);

create index if not exists protocol_sections_protocol_id_idx on public.protocol_sections (protocol_id);
create index if not exists protocol_sections_workflow_state_idx on public.protocol_sections (workflow_state);

-- ---------------------------------------------------------------------------
-- core_study_models
-- ---------------------------------------------------------------------------
create table if not exists public.core_study_models (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols (id) on delete cascade,
  version integer not null default 1,
  model jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists core_study_models_protocol_id_idx on public.core_study_models (protocol_id);
create index if not exists core_study_models_protocol_version_idx
  on public.core_study_models (protocol_id, version desc);

-- ---------------------------------------------------------------------------
-- knowledge_layers
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_layers (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols (id) on delete cascade,
  version integer not null default 1,
  knowledge jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_layers_protocol_id_idx on public.knowledge_layers (protocol_id);
create index if not exists knowledge_layers_protocol_version_idx
  on public.knowledge_layers (protocol_id, version desc);

-- ---------------------------------------------------------------------------
-- protocol_versions
-- ---------------------------------------------------------------------------
create table if not exists public.protocol_versions (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols (id) on delete cascade,
  commit_message text not null,
  commit_source text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists protocol_versions_protocol_id_idx on public.protocol_versions (protocol_id);
create index if not exists protocol_versions_created_at_idx on public.protocol_versions (created_at desc);

alter table public.protocols
  add constraint protocols_current_version_id_fkey
  foreign key (current_version_id) references public.protocol_versions (id)
  deferrable initially deferred;

-- ---------------------------------------------------------------------------
-- agent_events
-- ---------------------------------------------------------------------------
create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols (id) on delete cascade,
  agent_id text not null,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists agent_events_protocol_id_idx on public.agent_events (protocol_id);
create index if not exists agent_events_agent_id_idx on public.agent_events (agent_id);
create index if not exists agent_events_created_at_idx on public.agent_events (created_at desc);

-- ---------------------------------------------------------------------------
-- validation_runs
-- ---------------------------------------------------------------------------
create table if not exists public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols (id) on delete cascade,
  section_id text,
  status text not null,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists validation_runs_protocol_id_idx on public.validation_runs (protocol_id);
create index if not exists validation_runs_section_id_idx on public.validation_runs (section_id);

-- ---------------------------------------------------------------------------
-- source_documents
-- ---------------------------------------------------------------------------
create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.protocols (id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists source_documents_protocol_id_idx on public.source_documents (protocol_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists protocols_set_updated_at on public.protocols;
create trigger protocols_set_updated_at
  before update on public.protocols
  for each row execute function public.set_updated_at();

drop trigger if exists protocol_sections_set_updated_at on public.protocol_sections;
create trigger protocol_sections_set_updated_at
  before update on public.protocol_sections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth / RLS — deferred (no auth in scaffold PR)
-- ---------------------------------------------------------------------------
-- TODO(auth): enable row level security once user login and organizations exist.
-- alter table public.protocols enable row level security;
