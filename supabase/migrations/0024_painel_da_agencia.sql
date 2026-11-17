-- ----------------------------------------------------------------------------
-- O PAINEL DA AGÊNCIA: ADMINS QUE ENXERGAM TODAS AS SUBCONTAS
--
-- Até aqui cada pessoa via só a própria conta. Para atender três clientes,
-- o dono precisava de três logins - ou de pedir a senha do cliente. A
-- plataforma virou ferramenta da agência (0022, 0023), e ferramenta de
-- agência tem um painel central com as subcontas dentro.
--
-- Cada cliente continua sendo um `workspace`: tem cota própria, blog
-- próprio e, se quiser, login próprio que só vê o que é dele. O que entra
-- de novo é uma lista curta de administradores da agência.
--
-- A mudança inteira cabe numa função. Todas as regras de acesso do banco
-- perguntam a mesma coisa - "de quais workspaces esta pessoa é?" - a
-- `auth_workspace_ids()`. Para o administrador a resposta passa a ser
-- "todos". Nenhuma das vinte e tantas policies foi tocada, e subconta que
-- nascer amanhã já entra na resposta sem ninguém lembrar de vincular.
-- ----------------------------------------------------------------------------

create table if not exists agencia_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS ligada e nenhuma policy, de propósito: pelo navegador ninguém lê nem
-- escreve esta tabela. Quem pudesse inserir uma linha aqui viraria dono de
-- todos os clientes. Só o service role e as funções abaixo a alcançam.
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

-- A mesma função da 0001, com uma segunda resposta para o administrador.
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

-- Os dois administradores: os donos das contas que existiam antes de
-- outubro, que são as duas do dono da plataforma e do sócio (mesmo recorte
-- da 0021). Por data, e não por e-mail, para o endereço de ninguém morar no
-- repositório.
--
-- Para incluir mais um depois, no SQL Editor:
--   insert into agencia_admins (user_id)
--   select id from auth.users where email = 'pessoa@exemplo.com';
insert into agencia_admins (user_id)
select m.user_id
  from workspace_members m
  join workspaces w on w.id = m.workspace_id
 where w.created_at < '2026-10-01'
on conflict do nothing;
