-- ----------------------------------------------------------------------------
-- RODADAS EM SEGUNDO PLANO E ACOMPANHAMENTO SEMANAL
--
-- 1. `ai_visibility_runs`: a rodada do Radar GEO ganha registro próprio.
--
--    Antes a análise rodava dentro da requisição do navegador, uma pergunta
--    de cada vez, e só gravava no fim. Sair da tela ou estourar o tempo
--    perdia tudo - e ao voltar, a tela não sabia que havia algo rodando, então
--    o cliente clicava de novo e recomeçava do zero. Agora a rodada existe
--    antes da primeira pergunta, o trabalho continua depois que a resposta
--    volta ao navegador, e cada resposta é gravada assim que chega. A tela
--    lê o progresso daqui.
--
--    Sem policy de escrita para o usuário: quem cria e fecha a rodada é o
--    servidor, depois de validar que o blog pertence a quem chamou - mesmo
--    padrão de audit_findings.
--
-- 2. `site_audits.origem`: distingue auditoria pedida pelo cliente da feita
--    pelo acompanhamento semanal. A tela conta "o que mudou desde a última"
--    sem precisar que o cliente lembre de voltar - é isso que transforma a
--    auditoria de coisa que se roda três vezes em coisa que se acompanha.
-- ----------------------------------------------------------------------------

create table if not exists ai_visibility_runs (
  id uuid primary key default uuid_generate_v4(),
  blog_id uuid not null references blogs(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'done', 'error')),
  -- Motores consultados nesta rodada ('claude', 'chatgpt', 'perplexity').
  -- Guardado na rodada porque a lista muda conforme as chaves configuradas,
  -- e a rodada antiga precisa continuar dizendo onde foi medida.
  providers text[] not null default '{}',
  total int not null default 0,       -- perguntas × motores
  falhas int not null default 0,
  origem text not null default 'manual'
    check (origem in ('manual', 'agendada')),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_ai_runs_blog
  on ai_visibility_runs(blog_id, started_at desc);

alter table ai_visibility_runs enable row level security;

drop policy if exists "members can read ai runs of their blogs" on ai_visibility_runs;
create policy "members can read ai runs of their blogs"
  on ai_visibility_runs for select
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

alter table site_audits
  add column if not exists origem text not null default 'manual'
    check (origem in ('manual', 'agendada'));
