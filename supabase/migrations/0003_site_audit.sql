-- ============================================================================
-- Auditoria de SEO do site do cliente
-- Diagnóstico que alimenta os outros módulos: lacuna de conteúdo vira
-- artigo, falha de GEO vira ação de visibilidade, erro técnico vira
-- instrução de correção.
-- ============================================================================

create table site_audits (
  id uuid primary key default uuid_generate_v4(),
  blog_id uuid not null references blogs(id) on delete cascade,
  site_url text not null,
  status text not null default 'running'
    check (status in ('running', 'done', 'error')),
  pages_analyzed int not null default 0,
  score_google int,           -- 0-100
  score_ai int,               -- 0-100 (prontidão para ser citado por IA)
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_audits_blog on site_audits(blog_id, created_at desc);

create table audit_findings (
  id bigint generated always as identity primary key,
  audit_id uuid not null references site_audits(id) on delete cascade,
  code text not null,         -- identificador estável da regra
  severity text not null
    check (severity in ('critical', 'high', 'medium', 'quick_win', 'info')),
  category text not null
    check (category in ('crawlability', 'indexation', 'onpage', 'content', 'geo', 'technical')),
  title text not null,
  impact text,
  evidence text,
  fix text,
  affected_urls text[] not null default '{}',
  affected_count int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_findings_audit on audit_findings(audit_id, severity);

-- ============================================================================
-- RLS
-- ============================================================================
alter table site_audits enable row level security;
alter table audit_findings enable row level security;

create policy "members can manage audits of their blogs"
  on site_audits for all
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())))
  with check (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

create policy "members can read findings of their audits"
  on audit_findings for select
  using (audit_id in (
    select id from site_audits
    where blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids()))
  ));
