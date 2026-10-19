-- ============================================================================
-- COLE ISTO INTEIRO NO SQL EDITOR DO SUPABASE E CLIQUE EM RUN.
-- Pode rodar duas vezes sem estragar nada.
--
-- 1. Libera a conta do cliente Mibolsillo, que está travada desde 18/10.
-- 2. Migração 0020 - marca quando a conexão do Google morre.
-- 3. Migração 0021 - a cota de artigos de cada plano.
-- ============================================================================

-- 1 ---------------------------------------------------------------- LIBERAR
update workspaces set liberado = true where name = 'Mibolsillo';

-- 2 ------------------------------------------------------------------- 0020
alter table google_integration
  add column if not exists quebrada_em timestamptz;

comment on column google_integration.quebrada_em is
  'Quando o refresh token parou de valer. Nulo = conexão viva.';

-- 3 ------------------------------------------------------------------- 0021
alter table workspaces
  add column if not exists artigos_por_mes int;

comment on column workspaces.artigos_por_mes is
  'Artigos por mês do plano contratado (4, 12, 30, 90 ou outro). Nulo na prova grátis, que tem 5 artigos no total, não por mês.';

-- Só as contas do dono. Conta criada em outubro ou depois começa na prova,
-- que é o que ranknow.es/planes promete - sem isto, Mibolsillo ganharia de
-- graça o degrau mais caro do site.
update workspaces
   set plan = 'pro', artigos_por_mes = 90
 where created_at < '2026-10-01'
   and plan is distinct from 'pro';

-- Confere o resultado.
select name, liberado, plan, artigos_por_mes, created_at::date
  from workspaces order by created_at;
