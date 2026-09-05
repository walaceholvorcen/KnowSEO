-- ----------------------------------------------------------------------------
-- AUDITORIA DE GOOGLE MEU NEGÓCIO
--
-- Mesmo formato de site_audits/audit_findings, de propósito: é a mesma
-- lógica de produto (nota + achados + histórico), só que sobre um perfil
-- do Google em vez de páginas do site. Manter o formato igual facilita
-- reaproveitar UI e mental model já validados.
--
-- Diferença de escopo: aqui não existe "páginas analisadas" (é um perfil
-- só), então sem affected_urls/affected_count - a penalidade não precisa
-- diluir por alcance como na auditoria de site.
-- ----------------------------------------------------------------------------

create table gbp_audits (
  id uuid primary key default uuid_generate_v4(),
  blog_id uuid not null references blogs(id) on delete cascade,
  query text not null,          -- o que o cliente digitou para achar o perfil
  place_id text,
  place_name text,
  place_address text,
  maps_uri text,
  status text not null default 'running'
    check (status in ('running', 'done', 'not_found', 'error')),
  score int,                    -- 0-100
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_gbp_audits_blog on gbp_audits(blog_id, created_at desc);

create table gbp_findings (
  id bigint generated always as identity primary key,
  audit_id uuid not null references gbp_audits(id) on delete cascade,
  code text not null,
  severity text not null
    check (severity in ('critical', 'high', 'medium', 'quick_win', 'info')),
  title text not null,
  impact text,
  evidence text,
  fix text,
  created_at timestamptz not null default now()
);

create index idx_gbp_findings_audit on gbp_findings(audit_id);

alter table gbp_audits enable row level security;
alter table gbp_findings enable row level security;

create policy "members can manage gbp_audits of their blogs"
  on gbp_audits for all
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())))
  with check (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

create policy "members can read gbp_findings of their blogs"
  on gbp_findings for select
  using (
    audit_id in (
      select id from gbp_audits
      where blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids()))
    )
  );
