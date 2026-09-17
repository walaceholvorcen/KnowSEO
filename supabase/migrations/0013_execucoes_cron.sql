-- ----------------------------------------------------------------------------
-- REGISTRO DE EXECUÇÃO DO CRON
--
-- A reauditoria de segunda passou semanas sem rodar sem deixar rastro: o log
-- da Vercel expira, e a tela não tinha como distinguir "o cron não disparou"
-- de "disparou e nada estava vencido". Cada disparo grava início e fim aqui.
--
-- RLS ligado e SEM policy: só o service role lê e escreve. O `detalhe` lista
-- blogs de todos os clientes, então nenhum usuário pode ler a tabela direto;
-- a tela recebe só data e contagens, lidas no servidor.
-- ----------------------------------------------------------------------------

create table if not exists cron_execucoes (
  id uuid primary key default gen_random_uuid(),
  rota text not null,
  iniciada_em timestamptz not null default now(),
  terminada_em timestamptz,   -- nulo = morreu no meio (estourou o tempo)
  tarefas int,
  falhas int,
  detalhe jsonb
);

create index if not exists idx_cron_execucoes_rota
  on cron_execucoes(rota, iniciada_em desc);

alter table cron_execucoes enable row level security;
