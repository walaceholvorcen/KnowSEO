-- ----------------------------------------------------------------------------
-- ANÁLISE DE MERCADO
--
-- A etapa que faltava antes da Estratégia: em vez de pedir pauta à IA no
-- vácuo, primeiro medir onde o mercado escreve e onde o cliente não está.
--
-- Duas fontes, as duas reais, guardadas separadas de propósito porque têm
-- naturezas diferentes e a tela precisa dizer isso ao cliente:
--
--   market_themes  - cobertura de conteúdo dos concorrentes, lida do sitemap
--                    público deles. NÃO é volume de busca. Mede quantos
--                    artigos existem sobre um tema, não quanta gente procura.
--   market_chances - Search Console do próprio cliente. Aqui sim é dado do
--                    Google: impressão, clique e posição de verdade.
--
-- Mesmo formato de site_audits/gbp_audits (rodada + itens + histórico) para
-- reaproveitar o modelo mental já validado nas outras telas.
-- ----------------------------------------------------------------------------

create table market_analyses (
  id uuid primary key default uuid_generate_v4(),
  blog_id uuid not null references blogs(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'done', 'error')),
  -- Domínios que o cliente apontou como concorrentes nesta rodada. Guardado
  -- na rodada, não no blog: a lista muda com o tempo e a análise antiga
  -- precisa continuar explicando contra quem ela comparou.
  competitor_domains text[] not null default '{}',
  client_pages int not null default 0,
  competitor_pages int not null default 0,
  -- Se o Search Console estava conectado no momento da rodada. Sem isto, uma
  -- análise antiga sem chances parece "não achou nada" quando na verdade era
  -- "não tinha de onde olhar".
  gsc_conectado boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_market_analyses_blog on market_analyses(blog_id, created_at desc);

create table market_themes (
  id bigint generated always as identity primary key,
  analysis_id uuid not null references market_analyses(id) on delete cascade,
  termo text not null,
  paginas_cliente int not null default 0,
  paginas_concorrentes int not null default 0,
  concorrentes_que_cobrem int not null default 0,
  lacuna int not null default 0,
  situacao text not null check (situacao in ('lacuna', 'disputado', 'seu_terreno')),
  -- Títulos reais de concorrentes. Um tema sem prova é palpite: a tela mostra
  -- o artigo que existe para o cliente conferir que não inventamos.
  exemplos text[] not null default '{}',
  posicao int not null default 0
);

create index idx_market_themes_analysis on market_themes(analysis_id, posicao);

create table market_chances (
  id bigint generated always as identity primary key,
  analysis_id uuid not null references market_analyses(id) on delete cascade,
  query text not null,
  tipo text not null check (tipo in ('pagina_dois', 'sem_clique')),
  impressoes int not null default 0,
  cliques int not null default 0,
  posicao numeric(5,1) not null default 0
);

create index idx_market_chances_analysis on market_chances(analysis_id);

alter table market_analyses enable row level security;
alter table market_themes enable row level security;
alter table market_chances enable row level security;

create policy "members can manage market_analyses of their blogs"
  on market_analyses for all
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())))
  with check (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

create policy "members can read market_themes of their blogs"
  on market_themes for select
  using (
    analysis_id in (
      select id from market_analyses
      where blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids()))
    )
  );

create policy "members can read market_chances of their blogs"
  on market_chances for select
  using (
    analysis_id in (
      select id from market_analyses
      where blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids()))
    )
  );
