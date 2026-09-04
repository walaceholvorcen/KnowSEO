-- ============================================================================
-- Motor de Visibilidade em IA (GEO)
-- Perguntas que um comprador real faria -> rodadas periodicamente em
-- provedores de IA -> registro de se a marca do cliente foi citada.
-- ============================================================================

-- Identidade da marca usada pelo detector de citação
alter table blogs
  add column if not exists brand_names text[] not null default '{}',
  add column if not exists brand_domains text[] not null default '{}';

-- Perguntas monitoradas (o "conjunto de sondagem" de cada blog)
create table ai_queries (
  id uuid primary key default uuid_generate_v4(),
  blog_id uuid not null references blogs(id) on delete cascade,
  question text not null,
  intent text check (intent in ('discovery', 'comparison', 'local', 'problem')),
  active boolean not null default true,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  created_at timestamptz not null default now(),
  unique (blog_id, question)
);

create index idx_ai_queries_blog on ai_queries(blog_id, active);

-- Resultado de cada checagem
create table ai_visibility_checks (
  id bigint generated always as identity primary key,
  blog_id uuid not null references blogs(id) on delete cascade,
  query_id uuid not null references ai_queries(id) on delete cascade,
  provider text not null,
  cited boolean not null default false,
  match_type text check (match_type in ('domain', 'brand', 'none')),
  position int,                 -- ordem da citação na resposta (1 = primeira)
  competitors text[] not null default '{}',
  answer_excerpt text,
  checked_at timestamptz not null default now()
);

create index idx_checks_blog_time on ai_visibility_checks(blog_id, checked_at desc);
create index idx_checks_query on ai_visibility_checks(query_id, checked_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table ai_queries enable row level security;
alter table ai_visibility_checks enable row level security;

create policy "members can manage ai_queries of their blogs"
  on ai_queries for all
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())))
  with check (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

create policy "members can read ai checks of their blogs"
  on ai_visibility_checks for select
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));
