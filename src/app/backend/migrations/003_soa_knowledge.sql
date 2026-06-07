-- M11 Studio — SoA Knowledge Model tables (architecture scaffold)

create table if not exists soa_knowledge_models (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid references protocols(id) on delete cascade,
  version integer not null default 1,
  model jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists soa_entities (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid references protocols(id) on delete cascade,
  entity_type text not null,
  name text not null,
  normalized_name text not null,
  payload jsonb not null default '{}'::jsonb,
  source_section_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists soa_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid references protocols(id) on delete cascade,
  assessment_id text,
  procedure_id text,
  activity_id text,
  visit_id text,
  arm_id text,
  epoch_id text,
  condition_id text,
  timing_window_id text,
  required boolean not null default true,
  notes text,
  source_section_ids jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists soa_knowledge_models_protocol_id_idx on soa_knowledge_models(protocol_id);
create index if not exists soa_entities_protocol_id_idx on soa_entities(protocol_id);
create index if not exists soa_entities_entity_type_idx on soa_entities(entity_type);
create index if not exists soa_entities_normalized_name_idx on soa_entities(normalized_name);
create index if not exists soa_schedule_rules_protocol_id_idx on soa_schedule_rules(protocol_id);
create index if not exists soa_schedule_rules_assessment_id_idx on soa_schedule_rules(assessment_id);
create index if not exists soa_schedule_rules_visit_id_idx on soa_schedule_rules(visit_id);
create index if not exists soa_schedule_rules_arm_id_idx on soa_schedule_rules(arm_id);
create index if not exists soa_schedule_rules_epoch_id_idx on soa_schedule_rules(epoch_id);
