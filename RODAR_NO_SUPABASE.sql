-- ============================================================================
-- COLE NO SQL EDITOR DO SUPABASE E CLIQUE EM RUN.
--
-- Migração 0022: conta nova passa a nascer liberada.
-- O freio deixa de ser a sua aprovação manual e passa a ser a cota de 5
-- artigos da prova, que já está ligada desde o SQL de ontem.
--
-- A coluna continua existindo: para pausar uma conta específica, basta
--   update workspaces set liberado = false where name = 'Fulano';
-- ============================================================================

alter table workspaces
  alter column liberado set default true;

comment on column workspaces.liberado is
  'true = pode usar as operações que gastam IA. Nasce true desde a 0022; false é pausa manual de uma conta específica. Só o dono muda (service role).';

-- Confere: a coluna tem que aparecer com default "true".
select column_name, column_default
  from information_schema.columns
 where table_name = 'workspaces' and column_name = 'liberado';
