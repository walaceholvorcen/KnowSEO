-- ============================================================================
-- Schema inicial: SaaS multi-tenant de geração automática de conteúdo (blog)
-- Modelo: Workspace (agência/cliente) -> Blogs (1 ou N) -> Keywords/Articles
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- WORKSPACES (conta / agência) e membros
-- ----------------------------------------------------------------------------
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'agency')),
  credits int not null default 1,
  onboarding_steps jsonb not null default '{
    "brand_dna": false,
    "domain_connected": false,
    "analytics_connected": false,
    "first_article_published": false,
    "site_analyzed": false
  }'::jsonb,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ----------------------------------------------------------------------------
-- BLOGS (um workspace pode ter vários blogs = multi-cliente / agência)
-- ----------------------------------------------------------------------------
create table blogs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  subdomain text unique not null, -- ex: "cliente-x" -> cliente-x.nossodominio.com
  custom_domain text unique,      -- ex: "blog.clienteX.com" (opcional, pós-conexão)
  domain_status text not null default 'pending' check (domain_status in ('pending', 'active', 'error')),
  language text not null default 'es' check (language in ('es', 'pt', 'en')),
  theme jsonb not null default '{
    "primary_color": "#7c3aed",
    "logo_url": null,
    "tagline": null
  }'::jsonb,
  cta_config jsonb not null default '{
    "type": "link",
    "button_text": "Saber más",
    "button_url": null,
    "whatsapp_number": null
  }'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_blogs_workspace on blogs(workspace_id);

-- ----------------------------------------------------------------------------
-- DNA DA MARCA (por blog) - a config que alimenta todo prompt de geração
-- ----------------------------------------------------------------------------
create table brand_dna (
  blog_id uuid primary key references blogs(id) on delete cascade,
  description text,           -- o que a empresa faz
  target_audience text,       -- para quem escreve
  tone text default 'profesional y cercano',
  writing_style text,         -- regras extras de estilo
  banned_topics text,
  banned_words text,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- KEYWORDS (motor de estratégia - equivalente à tela "Estrategia")
-- ----------------------------------------------------------------------------
create table keywords (
  id uuid primary key default uuid_generate_v4(),
  blog_id uuid not null references blogs(id) on delete cascade,
  keyword text not null,
  suggested_title text,
  funnel_stage text check (funnel_stage in ('top', 'middle', 'bottom')),
  search_volume int,
  difficulty text check (difficulty in ('baja', 'media', 'alta')),
  opportunity_score text check (opportunity_score in ('buena', 'muy_buena', 'excelente')),
  status text not null default 'suggested' check (status in ('suggested', 'approved', 'rejected', 'written')),
  source text not null default 'ai' check (source in ('ai', 'dataforseo', 'manual')),
  created_at timestamptz not null default now()
);

create index idx_keywords_blog on keywords(blog_id, status);

-- ----------------------------------------------------------------------------
-- ARTICLES
-- ----------------------------------------------------------------------------
create table articles (
  id uuid primary key default uuid_generate_v4(),
  blog_id uuid not null references blogs(id) on delete cascade,
  keyword_id uuid references keywords(id) on delete set null,
  title text not null default '(sin título)',
  slug text not null,
  excerpt text,
  content_html text,          -- corpo do artigo renderizado (HTML)
  cover_image_url text,
  seo_title text,
  seo_description text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  scheduled_at timestamptz,
  published_at timestamptz,
  generation_status text default 'idle' check (generation_status in ('idle', 'generating', 'done', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (blog_id, slug)
);

create index idx_articles_blog on articles(blog_id, status);

-- ----------------------------------------------------------------------------
-- LINKAGEM INTERNA - páginas mapeadas do site do cliente p/ interlinking
-- ----------------------------------------------------------------------------
create table internal_links (
  id uuid primary key default uuid_generate_v4(),
  blog_id uuid not null references blogs(id) on delete cascade,
  url text not null,
  title text,
  description text,
  created_at timestamptz not null default now(),
  unique (blog_id, url)
);

-- ----------------------------------------------------------------------------
-- ANALYTICS DE PRIMEIRA PARTE (nosso diferencial: não depende do cliente
-- conectar GA/Search Console - já nasce medindo)
-- ----------------------------------------------------------------------------
create table analytics_events (
  id bigint generated always as identity primary key,
  blog_id uuid not null references blogs(id) on delete cascade,
  article_id uuid references articles(id) on delete set null,
  event_type text not null check (event_type in ('pageview', 'cta_click', 'whatsapp_click')),
  path text,
  referrer text,
  visitor_id text, -- hash anônimo (cookie-less), não é PII
  created_at timestamptz not null default now()
);

create index idx_analytics_blog_time on analytics_events(blog_id, created_at desc);
create index idx_analytics_article on analytics_events(article_id, event_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table blogs enable row level security;
alter table brand_dna enable row level security;
alter table keywords enable row level security;
alter table articles enable row level security;
alter table internal_links enable row level security;
alter table analytics_events enable row level security;

-- Helper: workspaces que o usuário logado pertence
create or replace function auth_workspace_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select workspace_id from workspace_members where user_id = auth.uid();
$$;

create policy "members can read their workspaces"
  on workspaces for select
  using (id in (select auth_workspace_ids()));

create policy "owners can update their workspaces"
  on workspaces for update
  using (id in (select auth_workspace_ids()));

create policy "authenticated users can create workspaces"
  on workspaces for insert
  with check (auth.uid() is not null);

create policy "members can read own membership rows"
  on workspace_members for select
  using (user_id = auth.uid() or workspace_id in (select auth_workspace_ids()));

create policy "users can create their own membership on signup"
  on workspace_members for insert
  with check (user_id = auth.uid());

create policy "members can manage blogs in their workspace"
  on blogs for all
  using (workspace_id in (select auth_workspace_ids()))
  with check (workspace_id in (select auth_workspace_ids()));

create policy "members can manage brand_dna of their blogs"
  on brand_dna for all
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())))
  with check (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

create policy "members can manage keywords of their blogs"
  on keywords for all
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())))
  with check (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

create policy "members can manage articles of their blogs"
  on articles for all
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())))
  with check (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

create policy "members can manage internal_links of their blogs"
  on internal_links for all
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())))
  with check (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

create policy "members can read analytics of their blogs"
  on analytics_events for select
  using (blog_id in (select id from blogs where workspace_id in (select auth_workspace_ids())));

-- Leitura pública de artigos publicados (para o blog público via subdomínio)
create policy "public can read published blogs metadata"
  on blogs for select
  using (true);

create policy "public can read published articles"
  on articles for select
  using (status = 'published');

-- Inserção de eventos de analytics é feita via service_role (API /api/track),
-- não diretamente pelo client anônimo - por isso não há policy de insert aqui.
