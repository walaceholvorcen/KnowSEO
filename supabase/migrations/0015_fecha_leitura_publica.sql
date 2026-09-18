-- ----------------------------------------------------------------------------
-- FECHA A LEITURA PÚBLICA DE BLOGS E ARTIGOS
--
-- Achado da revisão de segurança de 18/09 (item S6, isolamento entre
-- agências). A 0001 criou duas policies para o blog público ler o banco sem
-- sessão:
--
--   "public can read published blogs metadata"  on blogs    using (true)
--   "public can read published articles"        on articles using (status = 'published')
--
-- Policies de SELECT somam (OR) com as de membro. Com `using (true)`, a regra
-- "só membros do workspace" deixava de valer para leitura: qualquer um com a
-- chave anon - que até 17/09 estava no JavaScript do painel - listava os
-- blogs de TODAS as agências, com workspace_id, marca, domínios, número de
-- WhatsApp do CTA e propriedade do Search Console. Medido antes desta
-- migração: GET /rest/v1/blogs com a chave anon devolveu os blogs dos dois
-- workspaces existentes.
--
-- Nada no app depende delas: o blog público, o sitemap, o feed, o llms.txt,
-- a capa e o relatório compartilhado leem com o client de serviço
-- (src/lib/supabase/admin.ts), que ignora RLS e filtra pelo host. O painel
-- lê com a sessão do usuário e passa pela policy de membro, que continua.
--
-- Depois de aplicar, o mesmo GET com a chave anon deve devolver [].
-- ----------------------------------------------------------------------------

drop policy if exists "public can read published blogs metadata" on blogs;
drop policy if exists "public can read published articles" on articles;

-- ----------------------------------------------------------------------------
-- NINGUÉM ENTRA NO WORKSPACE DOS OUTROS
--
-- Segundo achado, e o mais grave, encontrado ao escrever o teste de
-- isolamento. A policy de INSERT em workspace_members conferia só uma
-- coisa:
--
--   with check (user_id = auth.uid())
--
-- Ou seja: "você só pode inserir a si mesmo" - em QUALQUER workspace. Com o
-- workspace_id de outra agência em mãos (que a policy pública de blogs
-- acima entregava a qualquer um), bastava criar uma conta e inserir
-- {workspace_id: <da vítima>, user_id: <eu>, role: 'owner'} para virar dono
-- dela e ler tudo pela RLS de membro: artigos, DNA, auditorias, integrações.
--
-- A policy existia para o cadastro: o workspace nasce e, logo em seguida,
-- quem o criou se vincula a ele. Então a regra certa é essa, e só essa -
-- você se vincula a um workspace que ainda não tem ninguém. Convite de
-- equipe, quando existir, entra por função no servidor, não por esta porta.
--
-- A checagem de "ainda sem membros" roda como security definer: uma policy
-- de workspace_members que consultasse workspace_members pela RLS entraria
-- em recursão (42P17), e a RLS esconderia justamente as linhas que provam
-- que o workspace já tem dono.
-- ----------------------------------------------------------------------------

create or replace function workspace_sem_membros(ws uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (select 1 from workspace_members where workspace_id = ws);
$$;

revoke all on function workspace_sem_membros(uuid) from public;
grant execute on function workspace_sem_membros(uuid) to authenticated;

drop policy if exists "users can create their own membership on signup" on workspace_members;
drop policy if exists "users can join only a workspace nobody owns yet" on workspace_members;

create policy "users can join only a workspace nobody owns yet"
  on workspace_members for insert
  with check (user_id = auth.uid() and workspace_sem_membros(workspace_id));
