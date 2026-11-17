-- ============================================================================
-- COLE NO SQL EDITOR DO SUPABASE (projeto SEO, organização DataKnow) E
-- CLIQUE EM RUN. Pode rodar duas vezes sem estragar nada.
--
-- Migração 0024: o painel da agência.
-- Você e o Renan passam a enxergar todas as subcontas (clientes) e a poder
-- criar novas. Cliente continua vendo só a conta dele.
-- ============================================================================

create table if not exists agencia_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table agencia_admins enable row level security;
revoke all on agencia_admins from anon, authenticated;

create or replace function eh_admin_da_agencia()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from agencia_admins where user_id = auth.uid());
$$;

revoke all on function eh_admin_da_agencia() from public;
grant execute on function eh_admin_da_agencia() to authenticated;

create or replace function auth_workspace_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from workspace_members where user_id = auth.uid()
  union
  select id from workspaces where eh_admin_da_agencia();
$$;

-- Os administradores: os donos das duas contas que existiam antes de
-- outubro (a sua e a do Renan).
insert into agencia_admins (user_id)
select m.user_id
  from workspace_members m
  join workspaces w on w.id = m.workspace_id
 where w.created_at < '2026-10-01'
on conflict do nothing;

-- Confere: tem que aparecer exatamente dois e-mails, o seu e o do Renan.
select u.email as administrador
  from agencia_admins a
  join auth.users u on u.id = a.user_id
 order by u.email;
