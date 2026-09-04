# Know SEO — MVP

SaaS multi-tenant que gera e publica artigos de blog com IA, adaptado para
o mercado espanhol.

> **Estado do projeto e próximos passos:** ver [ROADMAP.md](./ROADMAP.md).

## O que já funciona nesta versão

- Auth (Supabase) + workspace com onboarding de 5 passos que credita
  "+1 artigo" a cada passo concluído (mecânica de trial por progresso, não
  por tempo).
- Cada workspace cria um **blog hospedado** com subdomínio próprio
  (`cliente.seudominio.com`) via roteamento multi-tenant no `proxy.ts`
  (arquitetura de "um único deploy serve o app + todos os blogs dos
  clientes").
- **DNA da Marca**: descrição, público, tom de voz, regras de estilo -
  vira o prefixo de sistema (cacheado) de todo prompt de geração.
- **Estratégia**: a IA (Claude) sugere ideias de keyword com estágio de
  funil, dificuldade e "oportunidade". Se `DATAFORSEO_LOGIN`/`PASSWORD`
  estiverem configurados, enriquece com volume de busca real.
- **Geração de artigo completo** (título, meta SEO, HTML) via
  structured output do Claude, com enlace interno a partir de páginas
  mapeadas manualmente.
- **Editor** com WYSIWYG leve (contentEditable) e campos de SEO.
- **Blog público multi-tenant** servindo os artigos publicados, com CTA
  configurável (link ou WhatsApp).
- **Analytics de primeira parte**: pageviews e cliques em CTA/WhatsApp são
  registrados desde o primeiro artigo publicado, sem depender do cliente
  conectar Google Analytics/Search Console (diferencial vs. o produto que
  inspirou este projeto).

## O que ainda NÃO está implementado (próximas fases)

- Cobrança/planos (Paddle ou Lemon Squeezy) - schema já tem `plan` e
  `credits`, falta integrar checkout e webhooks.
- Conexão automática de domínio próprio via API da Vercel (hoje o campo
  `custom_domain` só é salvo - o apontamento DNS/CNAME é manual).
- Crawler automático de sitemap para popular `internal_links` (hoje é
  manual, um link por vez).
- Piloto automático (agendamento recorrente de geração+publicação).
- Multi-blog por workspace na UI (o schema já suporta N blogs por
  workspace - a UI hoje sempre usa `blogs[0]`).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase** (Postgres + Auth), com Row Level Security fazendo o
  isolamento multi-tenant
- **Anthropic API** (`claude-opus-5`) para geração de conteúdo, com
  structured outputs (Zod) e prompt caching no DNA da marca
- **DataForSEO** (opcional) para dados reais de keyword

> **Nota Next.js 16**: o arquivo de roteamento multi-tenant está em
> `src/proxy.ts` (não `middleware.ts` - a convenção foi renomeada nesta
> versão do framework).

## Setup

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode o conteúdo de
   `supabase/migrations/0001_init.sql`.
3. Em **Authentication > Providers**, mantenha "Email" habilitado. Para
   testar mais rápido em dev, desative "Confirm email" em
   **Authentication > Settings** (senão todo signup exige clicar num link
   de confirmação).
4. Copie **Project URL**, **anon public key** e **service_role key** de
   **Project Settings > API**.

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` e `ANTHROPIC_API_KEY`. Os demais campos têm
valores padrão que funcionam em desenvolvimento local.

### 3. Rodar localmente

```bash
npm install
npm run dev
```

- App (dashboard): [http://localhost:3000](http://localhost:3000)
- Um blog de teste, depois de criado no onboarding com o subdomínio
  `minha-empresa`, fica em `http://minha-empresa.localhost:3000`
  (subdomínios `*.localhost` funcionam nativamente no Chrome/Edge/Firefox,
  sem precisar editar o `hosts` file).

### 4. Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure as mesmas variáveis de ambiente do `.env.local`, trocando
   `NEXT_PUBLIC_APP_DOMAIN` e `NEXT_PUBLIC_ROOT_DOMAIN` pelo seu domínio
   real (ex: `app.contentos.es` e `contentos.es`).
3. Configure um domínio wildcard (`*.contentos.es`) apontando para o
   projeto na Vercel, além do domínio principal do app.
4. Domínios próprios de clientes (`blog.clienteX.com`) precisam ser
   adicionados ao projeto Vercel (hoje manual - automação via API fica
   para uma próxima fase).

## Estrutura de pastas

```
src/
  app/
    (auth)/login, (auth)/signup      - autenticação
    onboarding/                      - criação do primeiro blog
    (dashboard)/                     - painel: início, conteúdos,
                                       estratégia, relatórios, config
    _sites/[domain]/                 - blog público multi-tenant
                                       (renderizado via rewrite no proxy)
    api/                             - rotas de geração, tracking, etc.
  lib/
    anthropic.ts                     - prompts + geração via Claude
    dataforseo.ts                    - dados reais de keyword (opcional)
    supabase/                        - clients (browser/server/admin)
    tenant.ts                        - resolve blog pelo host
    workspace.ts                     - helpers de auth/workspace
  proxy.ts                           - roteamento multi-tenant por host
supabase/migrations/0001_init.sql    - schema + RLS
```

## Segredos

Chaves ficam **apenas** em `.env.local` (ignorado pelo git) e nas variáveis
de ambiente da Vercel. Nada de segredo em código.

O repositório tem um hook que bloqueia commit com chave ou arquivo de
ambiente. Ao clonar, ative com:

```bash
git config core.hooksPath .githooks
```

Se uma chave vazar, o certo é **revogar e gerar outra** — tirar do
histórico não desfaz a exposição.
