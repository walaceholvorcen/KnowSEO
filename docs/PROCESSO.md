# Know SEO — Processo de Construção

> **Para quem lê isto numa conversa nova:** este arquivo existe para você não
> começar do zero. Ele conta o que o produto é, por que cada decisão foi
> tomada, quais bugs já foram encontrados e corrigidos (e a causa raiz de
> cada um), o que está pronto e o que falta. Leia antes de propor qualquer
> mudança de arquitetura — muita coisa aqui já foi discutida e decidida.

Última atualização: setembro/2026
Repositório: https://github.com/walaceholvorcen/KnowSEO
Raiz do código: `platform/`

---

## 1. Como trabalhar comigo (o dono do projeto)

Isto foi dito explicitamente e vale para toda conversa futura:

- **Seja direto.** Nada de resposta floreada, nada de listar cinco opções e
  perguntar qual eu quero. Diga o que vai fazer e faça.
- **Aja como diretor de desenvolvimento.** Tome as decisões técnicas. Só me
  pergunte o que é decisão de negócio (preço, escopo, prioridade) ou o que
  depende de credencial/acesso que só eu tenho.
- **Valide de verdade.** Não diga "está pronto" sem rodar. Os bugs mais
  importantes deste projeto só apareceram quando a coisa rodou em produção
  com dado real.
- **Comentário no código explica o "porquê", não o "o quê".** O padrão do
  repositório é comentário curto explicando a razão da decisão ou o bug que
  aquilo evita. Siga esse padrão.
- Idioma do produto e dos comentários: **português**. A interface do blog
  público do cliente pode estar em espanhol (mercado alvo).

---

## 2. O que é o Know SEO

SaaS multi-tenant que gera e publica artigos de blog com IA, ao mesmo tempo
em que monitora a saúde de SEO do site do cliente e se a marca dele está
sendo citada por IAs.

Antes se chamava "Content OS". Foi rebatizado para **Know SEO**, tema azul
marinho, com dark mode (Claro/Escuro/Sistema).

### Os seis módulos

| Módulo | O que faz | Depende de IA? |
|---|---|---|
| **Auditoria SEO** | Diagnostica problemas no site do cliente: 21 regras, nota Google e nota IA | Não — determinístico |
| **Geração de Artigo** | Título, meta SEO, HTML semântico, links internos | Sim (Claude) |
| **Visibilidade em IA** | Detecta se a marca é citada por ChatGPT/Claude/Perplexity | Consulta sim, detecção não |
| **Estratégia** | Sugere keywords com etapa de funil, dificuldade e nota de oportunidade | Sim (Claude) + DataForSEO opcional |
| **Blog Multi-tenant** | Cada cliente tem blog em subdomínio ou domínio próprio | Não |
| **Analytics Próprio** | Pageview e clique em CTA sem depender do Google | Não |

**Decisão fundadora:** os módulos determinísticos funcionam sem a chave da
Anthropic. Isso foi de propósito — permitiu subir para produção e validar
auditoria, blog e analytics antes de ter a credencial de IA em mãos.

---

## 3. Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
  ⚠️ Esta versão tem breaking changes em relação ao que você provavelmente
  conhece. Consulte `node_modules/next/dist/docs/` antes de escrever código
  de rota. `params` é `Promise` e precisa de `await`.
- **Supabase** — Postgres + Auth + Row Level Security
- **Anthropic Claude** (`claude-opus-5`) com structured output validado por Zod
- **DataForSEO** (opcional) — volume de busca real quando configurado
- **Vercel** — deploy, com wildcard de subdomínio para os blogs

Testes: `npm test` (node:test nativo, sem framework). 56 testes hoje.

---

## 4. Arquitetura — decisões e o porquê

### 4.1 Multi-tenant com RLS
Cada workspace é isolado por Row Level Security no Postgres. O código de
aplicação não filtra workspace "na mão" nas rotas autenticadas — quem
garante o isolamento é o banco. O client admin (service role) só é usado
nas rotas públicas do blog, onde não existe sessão de usuário.

### 4.2 Resolução de tenant (`src/lib/tenant.ts`)
Três formas de chegar num blog:
1. subdomínio puro (`demo`) — rota de preview `/b/demo`
2. `cliente.nossodominio.com` — subdomínio próprio
3. `blog.docliente.com` — domínio próprio conectado

O proxy injeta o header `x-tenant-base` no modo preview. **Sem isso**,
sitemap, canonical e og:image apontariam para um subdomínio que não existe
em ambiente sem wildcard (ex.: `.vercel.app`).

Existem duas funções e a diferença importa:
- `tenantOrigin()` / `tenantBaseUrl()` → base do blog, **pode ter caminho**
  (`https://app.com/b/cliente`)
- `tenantAssetOrigin()` → **só esquema + host**. Usada para og:image, porque
  a capa mora na raiz do app (`/api/og/...`), não sob o caminho do tenant.

### 4.3 Padrão de provedor para Visibilidade em IA
`src/lib/ai-visibility/provider.ts` define a interface `AiProvider`. Hoje só
existe `claude-provider.ts`. Isso permite plugar Perplexity depois sem tocar
na lógica de negócio.

**A detecção de citação é determinística, não usa LLM.** `src/lib/citation.ts`
normaliza acentos, extrai domínios e casa com fronteira de palavra — para que
"Acme" não case dentro de "Acme Industries". Testado.

### 4.4 Regras de auditoria são funções puras
`src/lib/audit/rules.ts` — cada regra recebe os sinais das páginas e devolve
achados. Nenhuma faz rede. Por isso dá para testar tudo sem mock.

Pipeline: `parse.ts` (extrai 11 sinais por página; parser de HTML em JS puro,
sem jsdom, que seria lento) → `rules.ts` (21 regras) → `runner.ts` (orquestra:
sitemap, crawl, regras, notas).

### 4.5 Prompt caching
O "DNA da Marca" vira system message cacheado (`buildBrandSystemPrompt()`),
reaproveitado entre artigos do mesmo blog. Economiza token e mantém
consistência de voz.

---

## 5. A nota da auditoria (mudança importante)

**Problema:** vercel.com tirava 67/100. Injusto e sem significado.

**Causa raiz:** penalidade fixa por severidade (crítico = −25) independente
de quantas páginas o problema atingia. Um título duplicado em 1 de 50
páginas pesava igual a um em 50 de 50.

**Solução:** penalidade **proporcional ao alcance**.

- Peso por severidade: `critical=30`, `high=12`, `medium=6`, `quick_win=3`, `info=0`
- Multiplicado pela fração de páginas afetadas
- `MIN_SCOPE = 0.15` — mesmo 1 página afetada ainda conta alguma coisa
- **Achados de site inteiro** (HTTPS, robots.txt, sitemap) **não diluem**:
  o peso é integral, não importa se o site tem 1 ou 500 páginas

**Resultado:** vercel.com passou de 67 para 90.

**Faixas nomeadas** (`scoreBand()`) — número cru não diz nada ao cliente:

| Nota | Faixa |
|---|---|
| 90+ | Excelente |
| 70–89 | Bom |
| 50–69 | Precisa Atenção |
| <50 | Crítico |

Duas notas separadas: **Google** (todos os achados menos categoria `geo`) e
**IA** (só categoria `geo` — prontidão para ser citado por LLM).

Detalhe de implementação: o helper `scope()` devolve `{ affectedUrls, affectedCount }`.
`affectedUrls` é **amostra** (máx. 12, para não estourar a UI); `affectedCount`
é o total real. **A nota usa `affectedCount`.** Já houve bug por usar o
tamanho da amostra.

---

## 6. Bugs encontrados e corrigidos (com causa raiz)

Guardado porque cada um custou tempo e nenhum era óbvio.

### Nota da auditoria dura demais
Já descrito na seção 5. Penalidade fixa → proporcional.

### `max_tokens: 32000` exigia streaming
O SDK da Anthropic exige streaming acima de certo limite de tempo estimado.
Um artigo tem ~4.000 tokens. Baixado para **16.000** — margem suficiente e
sem a complexidade de streaming.

### Colisão de slug quando a geração falhava no meio
Se a geração quebrava, o rascunho ficava no banco. Tentar de novo com a
mesma keyword estourava no insert e o usuário ficava **preso naquela pauta**.
Corrigido com `uniqueSlug()`, que testa `-1`, `-2`... até achar livre.

### og:image apontando para caminho inexistente
No modo preview a base do tenant inclui `/b/demo-prod`. Uma URL relativa
resolvida contra ela virava `/b/demo-prod/api/og/...` — 404, preview social
quebrado. Corrigido com `tenantAssetOrigin()` (seção 4.2).

### Rotas de IA devolviam 500 com corpo vazio
Sem chave configurada, o SDK estourava por dentro e a tela travava sem
explicação. Criado `src/lib/ai-config.ts` com `isAiConfigured()` (valida o
prefixo `sk-ant-`). As rotas agora devolvem:
- **503** + mensagem clara quando não há chave
- **502** quando a IA falha em tempo de execução

### Chave da Anthropic salva mascarada na Vercel
Foi colado o valor **mascarado** que a UI mostra (`sk-ant-a•••`) em vez da
chave real. Uma rota de diagnóstico revelou o caractere `•` (U+2022) dentro
do header. Solução: colar a chave real, salvar, **redeploy**.
⚠️ Variável de ambiente na Vercel só passa a valer após novo deploy.

---

## 7. Segurança

- **`.githooks/pre-commit`** bloqueia commit com segredo: `sk-ant-api`,
  segredo do Supabase, chave de papel de serviço, chave AWS, chave PEM, e
  arquivos `.env` com valor real (ignora `.example`/`.sample`/`.template`).
  Ativar com:

  ```
  git config core.hooksPath .githooks
  ```

  O hook monta os padrões por concatenação de string de propósito — escrito
  inteiro, ele casaria consigo mesmo e bloquearia o próprio commit.

- **Proteção SSRF no crawler** (`src/lib/crawler.ts`): bloqueia localhost,
  IPs privados, link-local e protocolos não-http. 14 casos testados.

---

## 8. Banco de dados

Migrations em `supabase/migrations/`:
- `0001_init.sql` — workspaces, workspace_members, blogs, brand_dna,
  keywords, articles, internal_links, analytics_events
- `0002_ai_visibility.sql` — ai_queries, ai_visibility_checks
- `0003_site_audit.sql` — site_audits, audit_findings

Todas com RLS por workspace.

---

## 9. Estado atual — validado em produção

Rodado de ponta a ponta com dado real:

- ✅ Artigo real gerado (guia do Modelo 130, imposto espanhol) — 1.414
  palavras, 7 H2s, estrutura correta
- ✅ Publicado no blog; og:image renderizando
- ✅ Pageview registrado no analytics próprio
- ✅ Metadados SEO presentes: canonical, JSON-LD, Open Graph
- ✅ 56 testes passando (33 de parse+regras, 23 de proporcionalidade da nota)
- ✅ Auditoria: 25 páginas em ~4s; crawler: 200 páginas em ~5s

### SEO técnico por tenant (pronto)
`sitemap.xml`, `robots.txt` (crawlers de IA liberados **de propósito**),
`llms.txt` (índice em markdown para ChatGPT/Claude/Perplexity), `feed.xml`
(RSS), JSON-LD `Article`, URL canônica, capa gerada com a cor da marca que
serve também de preview ao compartilhar.

---

## 10. O que falta (em ordem de prioridade)

1. **Trava de qualidade do artigo** ← próximo
   Rodar as próprias regras de auditoria no HTML gerado **antes de deixar
   publicar**. Reprovar se: conteúdo raso (<300 palavras), sem H2, sem link
   interno, meta fora do tamanho. É a rede de segurança para quando a
   geração sair ruim — sem isso, artigo ruim vai ao ar com a marca do
   cliente. *Desenhado, não implementado.*

2. **Tela de ROI por artigo**
   "Este artigo trouxe 340 visitas e 6 conversas no WhatsApp." O dado de
   analytics **já existe**; falta só a tela. Muito retorno por pouco esforço.

3. **Ligar os achados da auditoria aos outros módulos**
   Achado "sem llms.txt" → botão "Habilitar Visibilidade IA".
   Achado "conteúdo raso" → botão "Gerar Artigo sobre X".

4. **Recuperação de senha** — não existe hoje. Cliente trancado para fora em
   um mês. É bloqueador comercial.

5. **Cron semanal de Visibilidade em IA** — para ter tendência de citação ao
   longo do tempo, não só uma foto.

6. **Cobrança / planos** — `plan` e `credits` já estão no schema; falta
   checkout e webhook (Paddle ou Lemon Squeezy).

7. **Agendamento de publicação** — `scheduled_at` já existe no schema; falta
   o cron que publica.

8. **Segundo provedor (Perplexity)** — API mais barata e devolve fontes
   citadas. O padrão de provedor já está pronto para receber.

9. **Domínio próprio automático** — hoje o DNS é manual; deveria provisionar
   via API da Vercel.

---

## 11. Como rodar

```
cd platform
npm install
cp .env.example .env.local   # preencher
npm run dev
```

Variáveis obrigatórias: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_ROOT_DOMAIN`.
Opcionais: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`.

Em dev, `*.localhost:3000` funciona nativamente no Chrome/Edge/Firefox sem
mexer no arquivo hosts.

```
npm test     # 56 testes
npm run lint
npm run build
```

---

## 12. Mapa do código

```
src/
  proxy.ts                      resolve tenant, injeta x-tenant-base
  app/
    (auth)/                     login, signup
    (dashboard)/                audit, contents, strategy, visibility,
                                reports, settings, dashboard
    api/
      audit/run                 roda auditoria
      articles/generate         gera artigo (créditos, slug único, links)
      keywords/suggest          sugere keywords (+ DataForSEO)
      ai-visibility/run         checa citação da marca
      internal-links/crawl      lê sitemap do cliente
      og/[articleId]            capa gerada
      track                     analytics de primeira parte
    sites/[domain]/             blog público: home, artigo, sitemap,
                                robots.txt, llms.txt, feed.xml
    onboarding/                 5 passos, créditos por progresso
  lib/
    audit/          parse, rules (21), runner, types, 2 arquivos de teste
    ai-visibility/  provider (interface), claude-provider, questions, runner
    supabase/       client, server, admin, middleware
    anthropic.ts    prompts + structured output (Zod)
    ai-config.ts    isAiConfigured()
    citation.ts     detecção determinística de citação
    crawler.ts      crawl de sitemap + guarda SSRF
    tenant.ts       resolução de tenant e origens
    dataforseo.ts   volume de busca real (opcional)
```

---

## 13. Regras que não devem ser quebradas

- Nunca colocar segredo no código. O hook bloqueia, mas não confie só nele.
- Nunca usar o tamanho da amostra (`affectedUrls`) em cálculo de nota — use
  `affectedCount`.
- Achado de escopo de site não pode diluir por número de páginas.
- Toda rota que chama IA precisa de `isAiConfigured()` antes e `try/catch`
  em volta, com mensagem útil.
- Metadados e og:image usam `tenantAssetOrigin()`, não `tenantBaseUrl()`.
- Regras de auditoria continuam funções puras, sem rede.
- O blog do cliente nunca herda o título do app — sempre o nome da marca dele.

---

## 14. Mapa do que existe hoje

Legenda: ✅ testado rodando · 🟡 construído, não validado ponta a ponta ·
⬜ não existe

> A chave da Anthropic **deixou de ser bloqueio** — está configurada em
> produção e a geração já rodou de verdade. Não há mais item 🔴.

### Conta e configuração
| | |
|---|---|
| ✅ | Cadastro, login, logout |
| ✅ | Workspace (+ tela de recuperação se o usuário ficar sem um) |
| ✅ | Criar blog com subdomínio |
| ✅ | Onboarding de 5 passos creditando +1 artigo cada |
| ✅ | Dark mode (Claro/Escuro/Sistema) |
| 🟡 | DNA da Marca (formulário salva e alimenta o prompt; não cliquei ponta a ponta) |
| 🟡 | Cor da marca, botão CTA (link ou WhatsApp) |
| ⬜ | Recuperação de senha — **bloqueio comercial** |

### Conteúdo
| | |
|---|---|
| ✅ | Editor de artigo (título, corpo, SEO) |
| ✅ | Estratégia — keywords com funil, dificuldade e oportunidade |
| ✅ | Gerar artigo com IA — rodou em produção (1.414 palavras, 7 H2s) |
| ✅ | Publicar → artigo aparece no blog público |
| 🟡 | Volume de busca real (só com DataForSEO configurado) |
| ⬜ | Trava de qualidade antes de publicar — **maior risco aberto** |
| ⬜ | Agendamento (campo `scheduled_at` existe, falta o cron que publica) |
| ⬜ | Piloto automático (escolher pauta + gerar + publicar sozinho) |

### Blog público — a parte mais sólida
| | |
|---|---|
| ✅ | Home do blog + página de artigo |
| ✅ | Capa gerada com a cor da marca |
| ✅ | Preview ao compartilhar (WhatsApp/LinkedIn) |
| ✅ | `sitemap.xml`, `robots.txt`, `llms.txt`, `feed.xml` |
| ✅ | JSON-LD + canonical |
| ✅ | Rodando em produção |
| 🟡 | Domínio próprio (campo salva, DNS é manual) |

### Auditoria de SEO
| | |
|---|---|
| ✅ | 21 regras — 25 páginas em ~4s |
| ✅ | Nota proporcional ao alcance, separada para Google e IA |
| ✅ | Faixas nomeadas (Excelente / Bom / Precisa Atenção / Crítico) |
| ✅ | Histórico por site |
| ⬜ | Achado virar ação (botão "gerar artigo", "habilitar visibilidade IA") |

### Linkagem interna
| | |
|---|---|
| ✅ | Crawler de sitemap (200 páginas em ~5s, não duplica) |
| ✅ | Proteção contra SSRF (14 casos) |
| ✅ | Adicionar página manualmente |

### Analytics
| | |
|---|---|
| ✅ | Tela de Relatórios |
| ✅ | Contador subindo com visita real (confirmado em produção) |
| ⬜ | ROI por artigo — o dado já está no banco, falta a tela |

### Visibilidade IA (diferencial)
| | |
|---|---|
| ✅ | Dashboard: score, evolução, concorrentes, status por pergunta |
| ✅ | Detector de citação, determinístico (17 testes) |
| ✅ | Degrada com aviso claro sem a chave |
| 🟡 | Gerar perguntas / Analisar (chave já funciona, não rodei ponta a ponta) |
| ⬜ | Cron semanal (hoje é foto pontual, sem tendência) |
| ⬜ | Segundo provedor (Perplexity) — interface pronta, falta o adaptador |

### Negócio
| | |
|---|---|
| ⬜ | Cobrança (`plan` e `credits` já no schema, falta checkout e webhook) |
| ⬜ | Multi-blog na interface (o banco já suporta) |
| ⬜ | Conexão automática de domínio via API da Vercel |

**Leitura:** o motor está bom. Falta o que transforma em produto vendável —
trava de qualidade (risco), senha e cobrança (bloqueio), ROI e piloto
automático (valor percebido).

---

## 15. Design — "tinta e sinal"

Toda tarefa de interface invoca a skill `frontend-design` antes de escrever
código. Não é opcional.

**A regra que manda em tudo:** neste produto a cor já tem função. As faixas
de nota falam por cor. Se a marca também for saturada nesse espectro, o
cliente não sabe mais se a cor significa "marca" ou "resultado". Logo: base
neutra, uma cor de marca só, e verde/âmbar/vermelho reservados para dado.

| Papel | Token | Hex |
|---|---|---|
| Fundo claro | `slate-100` | `#f3f4f1` |
| Texto / fundo escuro | `slate-900` | `#15191c` |
| Marca (ação, link, ativo) | `cobalto-600` | `#1b3fcb` |
| Realce de citação | `realce` | `#dde3ff` |
| Nota excelente / bom | `nota-excelente` | `#1f6b45` |
| Nota atenção | `nota-atencao` | `#8a5b0f` |
| Nota crítico | `nota-critico` | `#9e2a20` |

Os neutros substituem os **valores** do `slate` do Tailwind em vez de
renomear ~500 classes: o slate padrão puxa para azul e brigava com o
cobalto. O `navy-*` virou `cobalto-*` por renomeação mecânica.

Tipografia: **IBM Plex Sans** na interface, **IBM Plex Mono**
(`font-display`) só onde o número é o produto — nota da auditoria, score.
Números levam a classe `.tabular`. **Regra que virou lei depois de
feedback real ("parece uma revista"): serifada e manchete editorial não
entram no painel.** O produto mede posicionamento - a referência visual é
instrumento (radar, medidor), não editorial. O veredito que abre cada tela
é sans semibold com a ação à direita, header de ferramenta; já foi frase
gigante serifada duas vezes (Instrument Serif, depois Plex Serif) e as
duas vezes leu como capa de matéria.

Decisões que valem regra:
- A cor fica na faixa, nunca no número. Pintar o "55" de vermelho obriga o
  cliente a decorar o significado das cores antes de ler a tela.
- Faixa aparece sempre em duas formas — filete colorido **e** palavra —
  para quem não distingue as cores.
- Nada de rótulo em CAIXA ALTA acima de conteúdo. Foi removido de todas as
  telas; é o tique mais denunciador de página gerada.
- A cor do cliente nunca assume texto branco: `src/lib/contrast.ts` decide
  entre papel e tinta pela luminância (WCAG). Vale para cabeçalho do blog,
  banner de CTA e capa gerada.
- O padrão do blog é tinta, não a cor do Know SEO — o blog é do cliente.
  Migration `0004` corrige o violeta pré-rebrand que sobrara no schema.

---

## 16. Google Meu Negócio (novo módulo)

Auditoria do perfil público do negócio no Google — mesma filosofia da
Auditoria SEO: determinística, sem precisar o cliente conectar nada.

**Por que só auditoria, e não gestão completa (responder avaliação, criar
post):** existem duas APIs do Google para isto, e são muito diferentes.

| | Places API (New) | Business Profile API |
|---|---|---|
| Autorização | só a nossa chave (projeto no Google Cloud) | OAuth por cliente **+** aprovação de acesso do Google |
| O que dá para ver | nome, endereço, status, telefone, site, horário, nota, nº de avaliações, fotos (contagem) | tudo isso + descrição, serviços, responder avaliação, criar post, métricas de ligação/rota |
| Bloqueio | nenhum, cai no primeiro dia | aprovação do Google pode levar semanas — fora do nosso controle, igual foi a chave da Anthropic |

Optamos pela Places API para o v1. **Não existe "descrição do negócio" nem
"serviços cadastrados" nem "o dono respondeu essa avaliação" no que
auditamos** — isso só a Business Profile API expõe, e exige o cliente
autorizar.

### Regras (7, determinísticas, sem rede — `src/lib/gbp/rules.ts`)

| Achado | Severidade |
|---|---|
| Perfil fechado (temporária ou permanentemente) | Crítico |
| Sem telefone | Alto |
| Sem site vinculado | Alto |
| Sem horário de funcionamento | Médio |
| Menos de 3 fotos | Ganho rápido |
| Menos de 10 avaliações | Ganho rápido |
| Nota abaixo de 4.0 | Informativo — não é "corrigível" com um clique, então não teria sentido cobrar como se fosse |

Nota final: peso fixo por severidade, sem diluição por alcance (aqui é um
perfil só, não várias páginas — a proporcionalidade da Auditoria SEO não se
aplica). Reutiliza as mesmas faixas nomeadas (Excelente/Bom/Precisa
Atenção/Crítico) via `scoreBand()`.

### Decisões de implementação

- **`NotaCard` foi extraído** de dentro de `audit-board.tsx` para
  `src/components/lede.tsx` — é o terceiro lugar que precisa de "nota de 0
  a 100 + faixa" (Google, IA, agora perfil no Google). Regra de três:
  na terceira repetição, vira componente compartilhado.
- **Confirmação do negócio:** a busca por texto pode achar o lugar errado
  (nome comum, cidade grande). A tela mostra nome + endereço encontrados
  logo na abertura, para o cliente confirmar antes de confiar na nota.
- **Custo:** cada campo pedido à Places API é cobrado. O field mask pede só
  o que as regras usam — nada de "trazer tudo e filtrar depois".
- **Credencial:** `GOOGLE_PLACES_API_KEY`, checada por `isGbpConfigured()`
  no mesmo padrão de `isAiConfigured()` — 503 com mensagem clara quando
  falta, resto do produto funciona normal.
- Schema (`0005_gbp_audit.sql`) espelha `site_audits`/`audit_findings` de
  propósito, sem `affected_urls`/`affected_count` (não fazem sentido para
  um perfil só).

### Pendências
- Ligar este módulo à corrente do painel Início (`src/lib/gargalo.ts`) —
  hoje ele fica de fora do diagnóstico de gargalo.
- Fase 2 (gestão via Business Profile API) segue bloqueada por aprovação do
  Google, fora do nosso controle.

---

## 17. Estratégia e Configurações no padrão do veredito

Mesma reforma da seção 15/16, aplicada às duas telas que ainda usavam o
formato antigo (título + subtítulo + lista de cards).

**Estratégia:** abre com `"N pautas esperando escolha"` em vez de título
genérico. Cada keyword virou linha com filete, não card - funil, dificuldade
e volume em uma frase corrida, sem pílula colorida decorativa (a pílula de
"oportunidade" antes era sempre verde, para os três valores possíveis -
cor que não distingue nada é decoração, não informação; virou texto plano).
Dificuldade reaproveita a cor das faixas de nota (fácil = mesma cor de
"saudável", difícil = mesma cor de "atenção") em vez de emerald/red cru.

**Configurações:** as três abas (DNA da Marca, Blog e Domínio, Interface)
ganharam abertura com veredito real, calculado a partir do dado:
- DNA da Marca: conta quantos dos 5 campos de voz estão preenchidos -
  "vazio" / "parcial: 3 de 5" / "completo".
- Blog e Domínio: usa `domain_status` do schema para dizer se o domínio
  próprio está ativo, aguardando DNS, ou com erro.
- Interface: sem diagnóstico (é config pura), mas com frase direta em vez
  de "Gerencie o tema da interface."

O bloco azul de ação em Linkagem Interna saiu pelo mesmo motivo do bloco
da Auditoria (seção 15): competia com o veredito no topo da tela.

### Espanhol residual eliminado
Sweep final encontrou e corrigiu: "Inicia sesión" (link no signup),
"Aún no hay páginas mapeadas", "páginas detectadas y guardadas",
"Detectar páginas automáticamente" (faltava o acento certo em português),
placeholder "suempresa.com/servicios", e comentários de código em
`src/app/page.tsx` e `signup/page.tsx`.

**Observação, não bug:** o DNA da Marca real do cliente de teste (blog em
`pt`) tem descrição e público-alvo escritos em espanhol - dado do próprio
cliente, não string da interface. O prompt já força a saída em português do
Brasil independente disso (seção 6), mas o conteúdo-fonte do DNA vale a
pena revisar com o cliente.

### NotaCard, Lede, Linha, Secao — vocabulário de tela estabelecido
Depois desta rodada, toda tela do painel (Início, Conteúdos, Auditoria,
Estratégia, Visibilidade IA, Google Meu Negócio, Relatórios, as 3 de
Configurações) usa o mesmo vocabulário de `src/components/lede.tsx`:
`Lede` (abertura com veredito), `Linha` (item de lista com filete),
`Secao` (rótulo de subseção), `NotaCard` (nota de 0-100 com faixa). Tela
nova deve usar essas peças antes de inventar layout próprio.

---

## 18. Análise de Mercado — a etapa que faltava antes da pauta

Pedido do cliente: "antes de fazer os blogs, fazer uma análise de mercado e
encontrar as maiores oportunidades, até visualmente, para agregar valor
para quem assinou o plano de SEO".

### A decisão que definiu o módulo: não inventar número

A Estratégia já sugeria pauta, mas `difficulty` e `opportunity_score` são
**opinião do modelo**, não dado de mercado (seção 14 e COMO_FUNCIONA). O
caminho fácil aqui era montar um quadrante bonito com esses campos e
chamar de análise de mercado. Isso seria um painel que mente — e num
produto que vende prova, o cliente descobre no primeiro cruzamento com
uma ferramenta de verdade.

Então o módulo só usa o que dá para medir sem comprar dado:

| Fonte | O que mede | Real? |
|---|---|---|
| Sitemap público dos concorrentes | quantos artigos cada um publicou por tema | sim, lido ao vivo |
| Search Console do cliente | impressão, clique e posição por termo | sim, dado do Google |
| `internal_links` do próprio cliente | o que ele já cobre | sim, do crawl que já existia |

**Volume de busca continua não existindo** enquanto a DataForSEO não for
ligada. A interface fala em "artigos publicados", nunca em "buscas" — a
regra está escrita no topo de `src/lib/mercado/temas.ts` porque é o tipo
de precisão que se perde numa refatoração distraída.

### Como o tema é extraído (tudo cálculo, zero IA)

Bigramas dos `<title>`, sem palavras vazias (pt + es). Bigrama em vez de
palavra solta porque "google ads" é tema e "google" é ruído.

Dois defeitos apareceram só ao rodar contra sites reais, e os dois viraram
teste:

1. **Assinatura variável no fim do título.** A remoção de boilerplate
   original casava a cauda inteira, e um concorrente real assinava
   "| Ranking comparado", "| Ranking actualizado", "| Ranking 2026" —
   caudas diferentes, mesma assinatura. Resultado: "ranking comparado"
   subia como tema de mercado. Agora a contagem é **por palavra da cauda**:
   "ranking" se revela repetida e cai.
2. **Um site sozinho abafando o mercado.** Um concorrente tinha 22 páginas
   de serviço com "agências SEO" e isso ficava em primeiro lugar. A
   ordenação passou a ser **largura antes de volume**: um tema que três
   concorrentes diferentes cobrem é evidência de demanda; um tema que só um
   cobre é o posicionamento dele — e a tela diz isso na própria linha.

Também não existe "oceano azul" aqui: tema que nenhum concorrente cobre
não entra. Cobertura zero num crawl não prova demanda nenhuma, prova só
que ninguém escreveu.

### A camada do Search Console

Duas situações de leitura direta, sem modelo no meio:

- **Página 2** (posição 11–20, ≥10 impressões): tem demanda, tem
  relevância reconhecida, e ninguém clica porque ninguém rola até lá.
- **Sem clique** (posição ≤10, ≥30 impressões, CTR <1%): o problema não é
  o conteúdo, é o título e a descrição no resultado.

Essa camada é extra, não requisito: se o token do Google falhar, o erro é
engolido e a análise de cobertura ainda vale.

### Detalhes que valem lembrar

- Os concorrentes sugeridos vêm do **Raio X - GEO** — domínios realmente
  citados no lugar da marca. Melhor ponto de partida que uma caixa vazia.
- As páginas do cliente são reaproveitadas de `internal_links` em vez de
  rastrear o mesmo site duas vezes; só cai no crawl ao vivo se aquela
  etapa nunca rodou.
- A barra de cada tema é normalizada pelo **maior total da lista**, não
  por linha: normalizada por linha, um tema com 2 artigos pareceria do
  mesmo tamanho de um com 22.
- "Gerar pauta" leva o tema e os títulos reais dos concorrentes para o
  prompt da Estratégia — a sugestão deixa de ser palpite no vácuo e passa
  a responder a uma lacuna medida.
- Medido em produção: 3 concorrentes de porte médio, ~18s.
- `Mercado` entra na barra lateral **antes** de Estratégia: a ordem da
  barra é a ordem do trabalho.

### Limite conhecido

Portal de notícia como concorrente polui o resultado (temas como "google
wallet", "iab spain" apareceram ao testar com um). É problema de escolha
de concorrente, não do cálculo — a tela orienta a apontar concorrentes
diretos.

---

## 19. Volume de busca real — Planejador de Palavras-chave do Google Ads

A Estratégia sempre foi o módulo mais frágil do produto pelo motivo escrito
na seção 14: `difficulty` e `opportunity_score` são leitura do modelo, não
dado de mercado. A DataForSEO resolveria, mas é paga e nunca foi ligada. O
Planejador de Palavras-chave resolve de graça, então virou a fonte padrão.

### A distinção que virou regra de esquema

O Google Ads devolve `competition` / `competitionIndex`, e o caminho
tentador era jogar isso no campo `difficulty` — "pronto, dificuldade agora é
real". Seria dado errado com cara de dado certo.

**`competition` é concorrência de ANUNCIANTES**: quantos estão dando lance
naquele termo. Não é dificuldade de ranquear organicamente. As duas andam
juntas em termo comercial ("advogado trabalhista madrid") e se separam por
completo em termo informativo — ninguém anuncia em "o que é tag canonical",
e ranquear ali pode ser dificílimo.

Por isso a migration 0009 cria `competition_index` como coluna própria, com
`comment on column` dizendo o que ela não é, e `difficulty` continua sendo
o que sempre foi. Na tela, as duas aparecem em linhas separadas e nomeadas:
o volume medido em cima, "Leitura da IA: ..." embaixo. Antes as duas se
misturavam na mesma frase e não havia como o cliente saber o que era medido
e o que era palpite.

### País: o parâmetro que ninguém lembra e que muda tudo

Volume de busca não existe solto — existe por país. "Agencia SEO" na Espanha
e no Brasil são números completamente diferentes, e o produto não pergunta
ao cliente onde ele vende.

A dedução é: **TLD do domínio primeiro, idioma como reserva**. O caso real
que forçou essa ordem está no banco — o blog `testando dataknow` tem
`language = 'pt'` e domínio `dataknow.es`, uma agência espanhola. Deduzir
pelo idioma traria volume do Brasil para decidir pauta na Espanha.

A dedução nunca fica escondida: a linha da pauta diz "1.900 buscas por mês
na Espanha". Palpite errado aparece na hora em vez de virar decisão em cima
do país errado. Se algum dia aparecer cliente `.com` vendendo em outro país,
aí sim vale um seletor por blog — não antes.

A preposição ("na Espanha", "no Brasil", "em Portugal") mora na tabela de
países junto do rótulo, não num `if` na interface: um ternário ali erraria
em metade dos países.

### Escopo somado à conexão existente

`adwords` entrou nos SCOPES da mesma conexão Google que já servia Search
Console e GA4. Uma tela de login para as três coisas. Consequência a lembrar
**toda vez que um escopo mudar**: a autorização antiga continua valendo com
os escopos velhos. Foi exatamente o que aconteceu com `userinfo.email` —
diagnosticado consultando a API com o refresh token guardado, que devolveu
apenas `webmasters.readonly` e `analytics.readonly`. Reconectar não basta se
o Google reaproveitar o consentimento: tem que revogar em
`myaccount.google.com/permissions` antes.

### Detalhes operacionais

- `GOOGLE_ADS_API_VERSION` é variável de ambiente porque o Google aposenta
  versões a cada poucos meses; virar a versão não deve exigir deploy.
- O corpo do erro do Google Ads é registrado no log (truncado em 800
  caracteres). É lá que aparece a causa real — token sem acesso básico,
  conta errada, versão morta. Sem isso a falha vira "não veio volume".
- Falha de volume nunca derruba a geração de pauta: é enriquecimento.
- `keywordSeed` aceita no máximo 20 termos por chamada; enviamos 8.
- **Sem campanha ativa gastando, o Google devolve faixas** em vez do número
  exato. Continua sendo medição do Google, e a tela de Integrações avisa.

### Oportunidade que ficou registrada e não foi feita

`generateKeywordIdeas` devolve, além dos termos que mandamos, **as ideias
relacionadas que o próprio Google sugere, já com volume**. Isso permitiria
inverter a Estratégia: em vez de a IA inventar keyword e o Google medir
depois, o Google propõe os termos reais e a IA escolhe os ângulos. É a
evolução natural do módulo — ficou de fora desta rodada só para não misturar
duas mudanças grandes na mesma entrega.

---

## 20. Raio X - GEO — o dia em que o diferencial parou de mentir

Revisão crítica do módulo (auditoria linha a linha, setembro/2026) encontrou
um defeito que invalidava a métrica que o produto vende como prova.

### O defeito

`claude-provider.ts` juntava **duas coisas diferentes no mesmo array**: as
fontes que o modelo de fato citou, e **todos os resultados brutos da busca**
— inclusive o que ele leu e descartou. O comentário no próprio código dizia
"Resultados brutos da ferramenta de busca" e logo abaixo fazia
`citationUrls.push(item.url)`.

Três consequências, todas graves num produto que vende prova de citação:

1. **Falso positivo direto.** Bastava o site do cliente aparecer no resultado
   de uma busca para a tela escrever "Citado como fonte, posição 1". O modelo
   podia nunca tê-lo mencionado.
2. **`position` não significava nada.** Era o índice num array misturado, e
   os blocos de busca entram antes do texto — ou seja, era aproximadamente a
   posição no SERP que o Claude consultou, vendida como posição na resposta.
3. **A lista de "concorrentes" era raspagem de SERP.** Por isso apareciam
   `semrush.com`, `sortlist.com`, `agencies.semrush.com` no banco real. E o
   lixo vazava: o painel Início chegava a anunciar "a IA cita semrush.com no
   seu lugar", e a Análise de Mercado usava essa lista para **sugerir
   concorrentes** — a ferramenta se auto-envenenava.

### A correção

`AiAnswer` passou a ter `citationUrls` **e** `searchResultUrls`, separados.
Só o primeiro prova citação.

O segundo não foi jogado fora, porque tem valor próprio e oposto:
`found_in_search` marca quando a busca **encontrou** a marca e o modelo
**escolheu outro**. É o diagnóstico mais acionável do módulo — o problema
não é ser descoberto, é o conteúdo da página. A tela diz isso com essas
palavras.

### Outras correções da mesma rodada

- **Diretório não é concorrente.** `isDirectory()` classifica agregadores,
  redes e enciclopédias numa lista própria (`directories`). Não são
  escondidos: viram uma seção com leitura própria — "quando a IA recorre a
  diretório é porque não achou empresa com resposta boa o bastante, e essa é
  a lacuna mais fácil de ocupar". Filtrado **na leitura também**, porque as
  checagens antigas continuam sujas no banco.
- **A tela afirmava algo falso.** Dizia "quando alguém pergunta ao ChatGPT"
  sobre dado 100% do Claude. Agora nomeia o motor medido, tirado do próprio
  registro (`provider`).
- **O detector estava cego.** `brand_names` e `brand_domains` existiam no
  schema desde o primeiro dia e **nunca tiveram tela** — o detector caía no
  nome do blog, que no banco de teste era "testando dataknow". Nenhuma
  menção real casaria nunca. O formulário agora vive em Configurações →
  Marca.
- **O blog hospedado contava como concorrente do próprio cliente.** Só
  `custom_domain` entrava nos domínios da marca; `dominiosDaMarca()` agora
  inclui `subdominio.ROOT_DOMAIN`.
- **Menção pelo endereço escrito.** "Visite clinicamadrid.es" no corpo da
  resposta não casava, porque só o *nome* era procurado no texto.
- **`run_id`.** A rodada era deduzida agrupando por `checked_at::date`. Duas
  análises no mesmo dia viravam um ponto só com totais somados — "15
  perguntas" virava "30" — e uma rodada que atravessasse a meia-noite se
  partia em duas. Agora cada rodada tem identidade; a data segue valendo
  como reserva para as linhas antigas.
- **O botão travava.** `call()` não tinha `try/catch`: função que estourasse
  o tempo limite deixava "Analisando..." preso até recarregar a página.
- **`answer_excerpt` era gravado e nunca exibido.** Agora é a prova do
  veredito, dentro da linha da pergunta. Subiu de 500 para 2000 caracteres,
  porque 500 cortavam no meio da frase que recomendava o concorrente.

### O laço que faltava

O módulo media a derrota e parava ali, com o gerador de artigo na tela ao
lado. Agora cada pergunta perdida tem **"Escrever a resposta"**, que leva a
pergunta ao prompt da Estratégia com instrução própria: ângulos concretos e
verificáveis, porque modelo não cita folheto.

É o único fosso disponível aqui. Profound, Peec e Otterly medem GEO melhor
que nós e **nenhuma delas escreve o conteúdo**. Medir é commodity; responder
não é.

---

## 21. Auditoria — de conferidor de tags para auditoria técnica

Mesma revisão crítica da seção 20. A evidência que abriu o caso foi empírica:
rodando contra dois sites reais, `dataknow.es` tirava 93 e
`isocialweb.agency` tirava 94 — duas empresas diferentes, notas quase
idênticas, ambas em "Excelente", com três e seis achados cosméticos. **A nota
não discriminava.**

### A linha que apagava metade do SEO técnico

`crawler.ts` fazia `return res.ok ? res : null`. Tudo fora da faixa de
sucesso era descartado, e isso eliminava por construção a categoria inteira:
sem status não há 404, não há 500, não há cadeia de redirecionamento, não há
comparação entre o que o sitemap anuncia e o que o site entrega.

E produzia um efeito perverso na nota: as páginas quebradas sumiam da
amostra e `totalPages` encolhia junto. **Quanto mais quebrado o site, mais
limpa a amostra que sobrava para avaliar.**

`fetchComStatus()` agora devolve status e URL final sem descartar nada.
`safeFetch` continua existindo com o mesmo contrato de antes, construído em
cima dele, para não mexer na linkagem interna.

Duas regras novas nascem desse dado, e as duas trazem **o valor medido na
evidência** em vez de repetir a definição da regra:

- `URLS_QUEBRADAS` — separa "respondeu erro" de "não respondeu" (timeout,
  DNS, TLS são problemas diferentes de um 404), e sobe para crítico quando
  há 5xx, porque erro de servidor faz o Google reduzir o rastreamento do
  site inteiro.
- `URLS_REDIRECIONADAS` — o endereço anunciado não é o final. Pegou de
  primeira, em site real: `isocialweb.agency → www.isocialweb.agency/`.

### Falsos positivos que estavam em pé

**`ROBOTS_BLOCKS_ALL` ignorava o agrupamento por User-agent.** Procurava
`Disallow: /` em qualquer lugar do arquivo. Um site que bloqueia rastreador
de IA — hoje comum — era acusado de bloquear o site inteiro, severidade
crítica, **−30 pontos**. Site saudável caía de 100 para 70.
`robotsBloqueiaTudo()` agora monta os grupos e respeita a precedência real:
se existe grupo do Googlebot ele manda, senão vale o curinga. Grupo de outro
agente não diz nada sobre indexação no Google.

**`alt=""` era contado como imagem sem alt** — e `alt=""` é a marcação
*correta* de imagem decorativa em WCAG. O próprio texto de correção da regra
dizia isso, e havia um teste congelando o comportamento errado. Corrigido o
código e o teste. Efeito medido: `dataknow.es` perdia 9 achados falsos e
subiu de 93 para 96.

**O botão travava.** `handleRun` não tinha `try/catch`: auditoria que
estourasse os 120s deixava "Analisando..." preso até recarregar a página — e
estourar é plausível num site grande.

### O que a mudança fez com as notas

| Site | Antes | Depois | Por quê |
|---|---|---|---|
| dataknow.es | 93 | 96 | sumiram 9 achados falsos de `alt=""` |
| isocialweb.agency | 94 | 90 | apareceu um redirecionamento real |

As duas notas se moveram em **direções opostas**. É exatamente isso que
poder de discriminação significa: antes as duas eram 93 e não diziam nada.

### O que continua faltando (ordem de retorno)

1. Link quebrado de verdade: os `<a href>` ainda são só contados, nunca
   requisitados. O `fetchComStatus` já é a peça que faltava.
2. Peso por importância de página — `noindex` na home de um site de 25
   páginas ainda dilui para 4,5 pontos e a nota fica "Excelente".
3. Piso da nota IA. Sem `llms.txt`, sem schema e sem H2, o pior caso ainda
   é ≈70, que é faixa "Bom".
4. `LOW_INTERNAL_LINKS` mede outlink e o texto fala de inlink — mede a coisa
   errada e quase nunca dispara.
5. SPA client-side ainda vira relatório de lixo (título duplicado e H1
   ausente em tudo). Precisa detectar o padrão e avisar, não pontuar.

---

## 22. Raio X - GEO em segundo plano, três assistentes, e a auditoria que se acompanha

Três pedidos do cliente numa mensagem só: o GEO "é muito demorado, e se eu
sair do radar ele para e se clicar em analisar volta de novo"; "precisamos
nos encontrar também fora do Claude, ChatGPT e Perplexity"; e, na
Auditoria, "como auditoria o cliente pode fazer umas 3 e não querer mais —
o que fazemos para ter recorrência?".

### Por que o GEO "parava"

Não parava por acaso: era a arquitetura. A rota rodava a análise **dentro
da requisição do navegador**, as perguntas **uma de cada vez**, e só
gravava no banco **no fim**. Quinze perguntas com busca na web, ~20s cada,
davam cinco minutos. Sair da tela ou estourar o tempo perdia a rodada
inteira, inclusive o que já tinha respondido — e ao voltar, nada dizia que
havia algo rodando, então o clique recomeçava do zero.

Quatro mudanças, cada uma matando um pedaço do problema:

1. **`after()` do Next 16** — a rota cria a rodada, responde na hora com o
   identificador, e o trabalho continua depois que a resposta voltou
   (`maxDuration = 300` vale para o `after`). A análise deixou de depender
   da tela aberta.
2. **Paralelo, seis por vez** — trinta consultas (dez perguntas × três
   motores) em cerca de dois minutos, contra cinco minutos para quinze
   consultas em série.
3. **Grava a cada resposta** — rodada interrompida deixa no banco tudo o
   que chegou até ali.
4. **`ai_visibility_runs`** (migração 0011) — a rodada tem registro próprio.
   A tela reabre em "12 de 30" quando o cliente volta, consulta o progresso
   a cada 3s em `/api/ai-visibility/status`, e mostra as respostas
   conforme chegam. Clique duplo devolve a rodada em curso em vez de abrir
   outra. Rodada "rodando" há mais de 10 minutos é órfã — morreu sem fechar
   — e é encerrada como erro para não travar o botão para sempre.

**Dez perguntas, não quinze.** Com três motores, cada pergunta custa três
consultas com busca. Gerar perguntas novas agora **substitui** o conjunto
(desativa as antigas): antes elas se acumulavam, e como a nota é "citadas /
total da rodada", o denominador mudava e a evolução deixava de ser
comparável.

### Três assistentes

`OpenAiProvider` (API de Responses com `web_search`) e `PerplexityProvider`
(`sonar`), ao lado do Claude, cada um ligado por uma chave de ambiente —
sem chave, o motor simplesmente não entra na rodada. A separação entre
citação e resultado de busca da seção 20 vale nos três: no ChatGPT, as
anotações `url_citation` são citação e `web_search_call.action.sources` é
busca; no Perplexity, `citations` e `search_results`.

Formatos confirmados na documentação oficial de cada um antes de escrever.
Duas proteções porque os dois trocam de interface com frequência: o modelo
da OpenAI e o endpoint do Perplexity ficam em variável de ambiente, e o
Perplexity cai para o endpoint histórico se o atual devolver 404.

**O Claude continua no Opus 5.** A regra do projeto é não trocar modelo sem
o dono pedir. O ganho de velocidade veio do paralelismo, que era o gargalo
real — não do modelo. O Sonnet 5 suporta a mesma ferramenta de busca e fica
como opção se o custo por rodada pesar.

**A tela passou a ler a rodada em duas camadas.** Com três motores, "citado
em 3 de 30" não diz nada: o cliente pensa em perguntas. O veredito conta
perguntas em que a marca apareceu em *pelo menos um* assistente, e um
placar mostra cada motor separado — a divergência entre eles é a
informação, porque cada um busca num índice diferente. Motor sem chave
aparece apagado com "Sem chave configurada", em vez de sumir.

### A auditoria que se acompanha

A resposta à pergunta da recorrência não é uma feature, é uma mudança de
natureza: **auditoria é um exame; o que se vende é acompanhamento.** SEO
não muda na hora — a correção de hoje aparece em semanas. Sem comparação,
cada auditoria nova é uma lista parecida com a anterior, "adiantou?" fica
sem resposta, e é por isso que o cliente para de voltar.

- **`compararAuditorias()`** casa achados pelo `code` (o título muda com o
  número de páginas; o código não) e devolve resolvidos, novos, e os que
  persistem — marcando os que estão atingindo menos páginas (correção em
  andamento) ou mais (piorando). A tela abre dizendo "Desde a auditoria
  anterior: 2 problemas resolvidos, 1 novo" e mostra a nota antes → depois.
  A anterior é sempre do **mesmo site**: comparar domínios diferentes
  fabricaria "resolvidos" que nunca foram corrigidos.
- **Acompanhamento semanal** (`/api/cron/semanal`, toda segunda às 7h UTC,
  `vercel.json`) reaudita o último site auditado e refaz o Raio X - GEO de
  cada blog, sem ninguém clicar. Critério "rodou há mais de seis dias", não
  "é segunda-feira" — o que não coube num disparo entra no seguinte.
  Protegido por `CRON_SECRET`: sem ele a rota recusa tudo, e a tela **não
  promete** reauditoria automática (a página só mostra a frase quando o
  segredo existe).
- **`registrarAuditoria()`** saiu da rota para `src/lib/audit/salvar.ts`:
  agora são dois caminhos que auditam, e duas cópias do fluxo divergiriam
  na primeira correção. A auditoria manual não escreve a coluna `origem`,
  então continua funcionando mesmo antes de a 0011 ser aplicada.

### Mercado

O aviso do Search Console aparecia só depois de uma análise concluída —
o cliente descobria que faltou dado depois de rodar. Agora aparece desde o
início, como link direto para Integrações.

### Pendências registradas

- Alerta por e-mail quando a reauditoria semanal encontra algo **novo**
  (404, `noindex` que apareceu). É o que traz o cliente de volta sem ele
  lembrar de abrir o painel — precisa de provedor de e-mail.
- Crédito por rodada do Raio X - GEO. Continua sem débito, e agora é a
  operação mais cara do produto: até trinta consultas com busca na web.

---

## 23. Acabamento de instrumento — o painel "elitizado"

Pedido do dono: "melhorar muito o design, deixar elitizado", usando as
skills de design instaladas (`impeccable` conduzindo, `ui-ux-pro-max` na
checagem de UX e acessibilidade, `frontend-design` já regra da casa).

### A leitura que definiu a direção

Premium num painel de ferramenta não vem de enfeite, vem de **rigor** — o
mesmo que separa um instrumento de medição caro de um barato. A identidade
da seção 15 ficou intacta (paleta, IBM Plex, nada de serifada, nada de
cara de revista). O que faltava era acabamento de sistema, e o levantamento
provou com números:

- **Não existia botão.** Havia mais de 20 botões principais escritos à mão,
  em 5 variações de altura e espaçamento, e 26 campos com 4 variações.
- **Zero estados de foco desenhados.** Quem navega por teclado via o
  contorno padrão do navegador, diferente em cada um.
- **Coluna de 768px em todas as telas** — uma das causas do "parece
  revista" registradas na seção 15 e nunca atacada.
- **O texto secundário não passava no contraste.** `slate-500` dava 3,6:1
  sobre o fundo, abaixo dos 4,5:1 exigidos para texto pequeno.

### O que mudou

- **`src/components/ui.ts`** — `botao()`, `campo()` e `pagina()`. Funções
  que devolvem classe, não componentes: servem igual para `<button>`,
  `<Link>` e `<a>`. Botão com filete claro no topo e sombra curta (lê como
  tecla), estado de pressionado, e **44px em tela de toque**
  (`pointer-coarse:`) mantendo o compacto no mouse. A troca nos 23 arquivos
  foi feita por script sobre `className` literal; o que estava escrito de
  outro jeito foi convertido à mão.
- **Alturas medidas, não estimadas.** Campo e botão lado a lado agora têm
  38px os dois (antes 38 e 36). Conferido no DOM renderizado.
- **`slate-500` escurecido para `#6a716b`**: 4,7:1 no fundo, 5:1 no branco.
  Um token corrigiu o contraste do texto secundário do app inteiro.
- **Superfícies do navegador** em `globals.css`: seleção de texto no realce
  da citação, cursor e barra de rolagem na paleta, `color-scheme` escuro
  no modo escuro, e `:focus-visible` desenhado para o app inteiro.
- **A régua** — a única ousadia do painel. A `NotaCard` mostra a nota numa
  escala graduada de 0 a 100 com marcas altas exatamente nos limiares das
  faixas (50, 70, 90), os mesmos de `scoreBand()`. O cliente vê que 88 é
  "Bom" *e* que está a dois pontos de "Excelente". Vem do mundo do
  instrumento de medição, não é decoração: a escala é a real.
- **Moldura** — barra lateral agrupada pela ordem do trabalho
  (Diagnóstico → Produção → Resultado), com o blog operado no topo e os
  créditos como leitura em mono. Item ativo sobe para a superfície branca,
  como tecla pressionada. **No celular vira topo com menu** — antes a barra
  fixa de 240px ocupava a tela; fechado, o menu sai também da ordem do Tab
  (`invisible` junto com o deslize) e fecha no Esc.
- **Largura** — telas de análise em 1024px (`pagina()`), formulários em
  768px (`pagina("estreita")`): campo largo demais obriga o olho a
  atravessar a tela para ler o rótulo.
- **O veredito virou `<h1>`.** Era `<p>`: as telas não tinham título para
  leitor de tela nem para navegação por cabeçalho.

### Um erro de conteúdo que a inspeção visual pegou

O Raio X - GEO ainda abria com "no seu lugar apareceu agencies.semrush.com" —
o dado anterior à correção da seção 20. O filtro de diretório na leitura
tinha ido para o Início e o Mercado e **faltado na tela do próprio Radar**.
Só apareceu olhando a tela renderizada com dado real; nenhum teste pegaria.

### Como a revisão visual foi feita

Sem sessão de login no navegador do agente, foi criada uma vitrine local
(`src/app/vitrine`) que renderiza as telas reais com o dado real pelo
client admin. Devolve 404 em produção e **não é versionada**
(`.git/info/exclude`). Uma rodada de inspeção (claro, escuro, celular),
correção em lote, uma rodada de confirmação — e o detector da `impeccable`
rodou uma vez no fim, com zero achados.

### Regras que ficam

- Botão, campo e largura de tela vêm de `ui.ts`. Controle escrito à mão é
  regressão.
- Contraste de texto secundário é medido, não estimado.
- A régua é a única assinatura visual. Não replicar o gesto em outras
  telas como enfeite — ela vale porque a escala é real.

## 24. Pesquisa de mercado — o que um SEO de 25 anos ensina (Daniel Sócrates)

Setembro/2026. Estudo do perfil @danielsocrates.seo (44,8 mil seguidores,
CEO da SEO Genome, autor do livro "SEO de Entidade", no ramo desde 2001),
posts das últimas semanas + site da agência. O que ele ensina, e o que
disso vira funcionalidade nossa.

### O que ele martela, resumido

1. **Entidade é a tese central** (o livro inteiro é sobre isso): "o Google
   não ranqueia texto, ele escolhe quem responde". Máquina só cita quem
   ela reconhece como entidade: nome, categoria, relações, dado
   estruturado. Demonstração dele: colar o texto do site na ferramenta de
   linguagem natural do Google — texto genérico ("líder de mercado,
   soluções inovadoras") devolve "nenhuma categoria encontrada".
2. **A IA copia de um punhado de fontes**: ~15 domínios concentram ~68%
   das citações de ChatGPT/Claude/Gemini/Perplexity/AI Overviews, e quase
   nenhum é o site da empresa — são perfis e fichas de terceiros (YouTube
   subiu, Reddit despencou). "Confira em quais desses 20 você aparece."
3. **Search Console é a mina subaproveitada**: relatório novo de IA
   generativa (AI Overviews/AI Mode dentro de Desempenho); a caixinha
   "Search generative AI" em Configurações (incluir/excluir das respostas
   de IA, já vem marcada); consultas em posição 11–20 = "o tráfego mais
   barato que você tem"; propriedades de rede social (Instagram/TikTok/
   X/YouTube) sem precisar de site.
4. **Conteúdo único vence produção em série**: o Google recompensa
   experiência própria, casos, opinião — o que máquina e concorrente não
   copiam. Responder pergunta real (AnswerThePublic, modelo Quora) é o
   conteúdo que a IA cita.
5. **SEO local como reforço de sinal**: perfil do Google, foto com
   geolocalização, NAP consistente.
6. **Método da agência dele** = Diagnóstico → Plano → Execução → Medição
   ("linha de base antes, série depois"), com silos de conteúdo.

### O que já temos e ele valida

- A corrente do Início é o método dele em tela (diagnóstico → pauta →
  conteúdo → medição).
- O Raio X - GEO mede citação de verdade em 3 motores — ele só consegue
  oferecer isso ao cliente via relatório manual.
- "Página 2" via Search Console já é a seção "onde você já quase ganha"
  do Mercado.
- O filtro de diretórios nas citações já separa "fonte" de "rival".

### O que incluir (prioridade da pesquisa)

1. **Auditoria de Entidade** — categoria nova de regras: JSON-LD de
   Organization/LocalBusiness com nome+categoria+sameAs; nome consistente;
   detector de texto genérico na home (frases vazias tipo "líder de
   mercado") = o teste "seu site fala de nada pra máquina". Já parseamos
   JSON-LD; é estender regra, não motor.
2. **Fontes que a IA usa no seu mercado** — já gravamos citações e
   resultados de busca das rodadas do Radar; agregar por domínio e
   mostrar "a IA se apoia nestes sites no seu setor; você aparece em X
   deles", com ação por fonte. Dado real nosso, ninguém pequeno tem.
3. **DNA da marca com experiência própria** — campos para casos,
   números e opiniões, injetados na geração; trava de qualidade que
   recusa artigo genérico (detector determinístico de frase vazia).
4. **Checklist Search Console na Auditoria** — itens educativos: caixinha
   de IA generativa conferida, relatório de IA generativa aberto,
   posições 11–20 revisadas. Quando a API expor o relatório de IA,
   puxar para o Mercado.
5. **Pautas-pergunta** — pauta tipo "pergunta respondida" com FAQ schema
   no artigo publicado (é o formato que a IA recorta).
6. **Sinais locais na auditoria** (enquanto o módulo GMN espera o
   cartão): LocalBusiness schema, endereço visível no rodapé, telefone.

## 25. Auditoria de Entidade e as fontes que a IA usa (itens 1 e 2 da seção 24)

### Auditoria de Entidade — `src/lib/audit/entidade.ts`

Cinco regras novas, todas na nota **IA** (categoria `geo`, sem migração):

| Código | Severidade | O que mede |
|---|---|---|
| `SEM_ENTIDADE` | alto (médio se o site não tem schema nenhum) | nenhum bloco Organization/LocalBusiness |
| `ENTIDADE_SEM_SAMEAS` | médio | organização sem link para os próprios perfis |
| `ENTIDADE_INCOMPLETA` | ganho rápido (médio se falta endereço/telefone de negócio local) | name, url, logo, description, address, telephone |
| `ENTIDADE_NOME_INCONSISTENTE` | ganho rápido | a empresa com mais de um nome entre páginas |
| `TEXTO_GENERICO` | médio, proporcional | ≥2 frases de folheto na mesma página ("líder de mercado", "soluciones innovadoras") |

Decisões:
- As quatro de entidade são **de site inteiro** (`SITE_INTEIRO` em
  `rules.ts`): a identidade da empresa é uma só, não dilui por página.
- `SEM_ENTIDADE` cai para médio quando o site não tem schema nenhum,
  porque `NO_SCHEMA` já cobra essa ausência por página — cobrar cheio nos
  dois puniria duas vezes.
- Vale a **ficha mais completa** do site: se uma página tem tudo, o que
  falta nas outras não impede o reconhecimento.
- Tipo múltiplo (`["Organization", "ProfessionalService"]`) usa o mais
  específico — é ele que diz se a empresa tem endereço físico. `Service`
  puro é oferta, não organização, e fica de fora.
- A lista de frases de folheto é conservadora: só entra o que não carrega
  fato em contexto nenhum. "Experiência" sozinho pode ser fato; "soluções
  inovadoras" nunca é. Duas frases na página, não uma: uma pode ser
  descuido num texto que tem fato.
- `tsconfig` ganhou `allowImportingTsExtensions`: é o primeiro módulo da
  auditoria importado por valor por outro, e os testes rodam no node puro,
  que exige a extensão.

Validado contra sites reais: `dataknow.es` ganha 2 achados verdadeiros
(sem `sameAs`; ficha sem logo e endereço); `isocialweb.agency` passa
limpo; o `seogenome.com` do próprio Daniel Sócrates tem a Organization sem
`sameAs` (o link para Instagram está só na pessoa) — a regra acerta.

### As fontes que a IA usa — `src/lib/ai-visibility/fontes.ts`

Substitui no Radar as listas "quem a IA cita no seu lugar" e "diretórios",
que mostravam um número grande e igual em cada linha ("1, 1, 1") e nada
sobre onde o cliente estava. Agora é uma lista só:

- Cada fonte com barra de **perguntas em que aparece / total da rodada**,
  tipo (concorrente ou plataforma) e em quais assistentes.
- **A linha "Seu site" entra na posição que a marca ocupa** — ver o
  próprio site atrás de um diretório é o argumento inteiro.
- Abertura: "A IA se apoiou em 46 sites diferentes para responder as
  perguntas do seu setor. O seu não é um deles." A frase de concentração
  ("as 5 maiores levam X%") só aparece a partir de 40%: num mercado de
  cauda longa, "5 sites levam 15%" é verdade que não diz nada.
- Ação dita uma vez por tipo, não um botão por linha: plataforma = ter
  perfil completo nela; concorrente = comparar no Mercado.
- Zero chamada nova: tudo sai do que as checagens já gravam. Diretório
  misturado em `competitors` (checagens antigas) é reclassificado na
  leitura.

## 26. Navegação lenta no painel — "parece que travou"

Queixa do dono: clicar para mudar de tela demorava, e o cliente podia
achar que o sistema tinha travado. Medido antes de mexer:

- Supabase e as funções da Vercel estão na mesma costa (iad1), banco a
  ~100ms. **Região não era o problema.**
- O **servidor de autenticação** do Supabase levava **300–700ms** por
  chamada — e era chamado **duas vezes a cada clique** (`getUser()` no
  proxy e de novo na página), antes de qualquer consulta de dado.
- Nenhuma tela do painel tinha `loading.tsx`. Todas são dinâmicas (dependem
  da sessão), e a doc do Next 16 é explícita: rota dinâmica sem
  `loading.tsx` não é pré-carregada e o clique espera o servidor inteiro
  sem mudar nada na tela.

O que mudou:

1. **`(dashboard)/loading.tsx`** — esqueleto no formato das telas (veredito
   com ação, linhas com filete). O Next pré-carrega esse esqueleto junto
   com os links do menu, então a tela troca **no instante do clique**.
2. **`getClaims()` no lugar de `getUser()`** no proxy e em
   `requireUserAndWorkspace`. O projeto assina o token com ES256 (conferido
   no JWKS), então a assinatura é verificada localmente contra a chave
   pública — é a recomendação atual do Supabase. O dado continua protegido
   pelo RLS; o token vencido continua sendo renovado no proxy.
3. **`cache()`** do React em `requireUserAndWorkspace` e
   `getWorkspaceBlogs`: layout e página pediam a mesma coisa na mesma
   requisição.
4. Vínculo e workspace **numa consulta só**, pelo relacionamento
   (`workspace:workspaces(*)`).
5. **Sinal no item do menu** (`useLinkStatus`): um ponto cobalto pulsa no
   item clicado enquanto a tela não entra — para o caso de o esqueleto
   ainda não ter sido pré-carregado (rede lenta, primeiros segundos).
   Tamanho fixo, só troca opacidade, para não empurrar o texto.

Resultado esperado por clique: de ~2 idas ao servidor de autenticação +
~5 consultas em sequência para 0 idas à autenticação + ~2 consultas antes
do dado da tela — e resposta visual imediata.

Atenção: o pré-carregamento só existe em produção (`next dev` não
pré-carrega). Testar a sensação de velocidade no deploy, não local.

## 27. A jornada do site — auditoria que retém

Pedido do dono, pela segunda vez: "o cliente faz 2 ou 3 auditorias, a nota
sobe e pra ele está bom". O histórico real confirma o padrão — o blog de
teste foi de 55 para 96 e parou. A seção 22 já tinha a comparação e a
reauditoria semanal; faltava **dizer ao cliente por que continuar, e
quando**.

### A tese

Nota alta é o começo da parte que dá resultado, por dois motivos que a
tela agora diz com data:

1. **O Google não reage na hora.** A correção vale no site no minuto em que
   é feita; a posição muda de 2 a 8 semanas depois. Quem para no dia em que
   a nota sobe perde a janela em que o efeito aparece.
2. **Site não fica parado.** Página nova, plugin, link que quebra — e
   ninguém avisa.

### O que entrou — `src/lib/audit/jornada.ts` (função pura, 6 testes)

- **Quatro etapas em sequência real**: Diagnóstico → Correção → Efeito no
  Google → Manutenção. A correção termina na primeira auditoria depois da
  qual nenhuma outra voltou a ter item crítico ou alto (se um alto
  reapareceu, conta da recuperação). O efeito é a janela de 14 a 56 dias
  depois dela, com as datas escritas. Manutenção começa quando a janela
  fecha.
- **Próxima verificação, com data e motivo** — substitui o card "Páginas
  analisadas", que ocupava o lugar mais nobre da tela sem pedir ação:
  - item alto aberto → "Agora": corrigir e rodar de novo, porque a
    auditoria confirma no site na hora;
  - correção há menos de 14 dias → 7 dias depois: confirmar que se manteve;
  - estável → mensal; vencida → "Atrasada", com a data da última;
  - com `CRON_SECRET` → a próxima segunda, 7h UTC, marcada como automática.
- **Gráfico de evolução** das notas Google e IA, com os limiares 50/70/90
  da régua e a frase "desde 04/09 a nota subiu 41 pontos". É a recompensa
  visível do trabalho — o motivo para voltar e ver a linha continuar.
- **Ação por etapa**: na janela do efeito, Mercado (o que o Google já
  mostra) e Estratégia; em manutenção, Raio X - GEO e Estratégia. A auditoria
  deixa de ser fim de linha e aponta para os módulos que fazem crescer.

### Decisões de gráfico (skill de dataviz)

- Cores validadas no validador da skill contra os dois fundos. Cinza para a
  série IA **reprovou** (lê como desativado); a paleta ficou em dois passos
  do cobalto — Google `cobalto-600`/`#7389f1` (escuro), IA `#94a6fa`/
  `#3450d4` — com a IA **tracejada** como segunda codificação e rótulos
  diretos no fim das linhas (o tom claro tem contraste abaixo de 3:1, e o
  rótulo é a compensação exigida).
- Um eixo só. Piso da escala na dezena abaixo da menor nota (nunca acima de
  40), escrito no eixo: com piso 0 o gráfico era metade vazio.
- SVG esticado só para linhas e grade (`vector-effect: non-scaling-stroke`);
  pontos, rótulos e dica em HTML por cima, para o texto não deformar.
- Dica ao passar o mouse ou focar pelo teclado em qualquer ponto da faixa
  vertical, e tabela escondida para leitor de tela.

### Pendência que fecha o laço

Lembrete por e-mail na data da próxima verificação e quando a reauditoria
semanal achar algo **novo**. É o que traz o cliente de volta sem ele
lembrar de abrir o painel — depende de provedor de e-mail.

## 28. Google Ads: o token morreu, a versão morreu, e a tela passou a medir

Ao passar o passo a passo do Planejador de Palavras-chave para o dono,
três coisas apareceram — todas descobertas batendo na API de verdade com o
token guardado no banco, não lendo documentação:

1. **A versão padrão estava morta.** `v21` (nosso default) devolve 404. Só
   `v22` a `v26` respondem, medido em setembro/2026. O padrão virou `v26`.
2. **O developer token foi aposentado** pelo Google em 9/9/2026: "optional
   and ignored by the API servers". O nível de acesso passou a ser do
   **projeto do Google Cloud** que gera as credenciais OAuth. Nosso
   `isGoogleAdsConfigured()` exigia o token — travaria para sempre quem
   cria a conta hoje e nunca vai receber um. A função foi removida.
3. **O nível concedido por padrão (Explorer) bloqueia justamente o
   Planejador** (`KeywordPlanIdeaService` está na lista de serviços de
   planejamento restritos). Precisa pedir **Básico**, que hoje é aprovado
   em minutos na página da Google Ads API dentro do Cloud Console.

E a conexão real do banco tinha só `webmasters.readonly` e
`analytics.readonly` — o escopo `adwords` foi somado ao código depois, e o
Google reaproveita o consentimento antigo. Sem revogar em
`myaccount.google.com/permissions`, reconectar não adianta.

### O que mudou no código

- **A conta de anúncios é descoberta sozinha** (`listAccessibleCustomers`):
  `GOOGLE_ADS_CUSTOMER_ID` virou opcional, e ideia de palavra-chave não
  muda de conta para conta. Um passo manual a menos para ativar.
- **`diagnosticarGoogleAds()`** pergunta ao Google o que a conexão consegue
  fazer e devolve um de cinco estados: sem conexão, sem escopo, sem conta
  de anúncios, sem acesso ao Planejador, pronto. A tela de Integrações
  mostra o estado medido e, quando falta acesso Básico, os três passos
  para resolver. Antes ela dizia "ligado" com base numa variável de
  ambiente, enquanto a API recusava toda chamada.
- O gate por variável saiu de `keywords/suggest`: o volume é enriquecimento
  e já degrada sozinho.

**Regra que fica:** credencial de terceiro se verifica chamando, não
lendo `process.env`. Este módulo passou semanas "configurado" sem nunca ter
respondido uma vez.

## 29. Senha e multi-cliente — dois dos três bloqueadores comerciais

Item 2 da avaliação (seção em `docs/AVALIACAO.md`): sem recuperação de
senha, sem cobrança e sem multi-cliente não existe venda. Dois foram
resolvidos aqui; cobrança depende de decisão de negócio.

### Recuperação de senha

- `/esqueci` → `resetPasswordForEmail` com `redirectTo` para
  `/api/auth/confirmar?destino=/nova-senha`.
- **A rota aceita os dois formatos de link** (`code` do fluxo PKCE e
  `token_hash` + `type` do modelo antigo). Qual chega depende do template
  do projeto no Supabase, e errar isso trancaria o cliente para fora
  justamente na tela feita para destrancá-lo.
- `destino` só é aceito se começar com `/` — parâmetro de URL não pode
  virar redirecionamento aberto.
- A confirmação é igual exista ou não a conta. Dizer "e-mail não
  cadastrado" entrega ao curioso quem é cliente.
- `/nova-senha` confere a sessão **antes** do formulário: link expirado
  vira aviso com link para pedir outro, em vez de erro depois de digitar.
- O aviso de link inválido no login ficou isolado em `<Suspense>`:
  `useSearchParams` derruba a pré-renderização estática da página inteira.

**Depende de configuração no Supabase (fora do código):** a URL do app em
Authentication → URL Configuration, `/api/auth/confirmar` na lista de
redirecionamentos permitidos, e SMTP próprio — o remetente padrão do
Supabase tem limite baixo e não serve para cliente real.

### Multi-cliente

- `getBlogAtivo()` lê o cookie `blog_ativo` e **confere se o id pertence ao
  workspace** antes de usar; valor desconhecido cai no primeiro blog. Sem
  essa checagem, editar o cookie à mão apontaria o painel para o cliente de
  outra agência (o RLS ainda barraria os dados, mas a tela erraria).
- Cookie, não coluna: a escolha é do navegador de quem opera, então duas
  pessoas da mesma agência podem estar em clientes diferentes ao mesmo
  tempo.
- `blogs[0]` saiu de 11 telas; a barra lateral virou seletor quando há mais
  de um cliente, com "Adicionar cliente" ao lado.
- `BLOG_COOKIE` mora em `src/lib/blog-cookie.ts`: importar `workspace.ts`
  do navegador arrastaria o client de servidor do Supabase para o pacote do
  front.
- O onboarding passou a servir também para cadastrar cliente novo
  (`?novo=1`) — e saiu do espanhol residual.

## 30. Trava de qualidade — as regras da auditoria antes de publicar

Risco mais caro que o produto tinha aberto: a geração saía ruim e ia ao ar
com a marca do cliente, sem ninguém conferir. A auditoria só acusaria
"página rasa" depois, no site dele.

`src/lib/artigo/qualidade.ts` (função pura, 10 testes) aplica ao artigo as
mesmas regras e os mesmos limites de `src/lib/audit/rules.ts`, em dois
níveis:

| Trava (bloqueia) | Aviso (publica e informa) |
|---|---|
| menos de 300 palavras | título de SEO fora de 30–60 |
| nenhum H2 | meta fora de 70–155 |
| nenhum link interno | 2+ frases de folheto (reusa `frasesVazias`) |
| pauta ausente do título e da abertura | parágrafo acima de 150 palavras |
| markdown ou tag de documento vazada | sem lista nem tabela |
| | menos de 2 números no texto inteiro |
| | pauta já publicada (canibalização) |

Decisões:

- **Dois níveis, não um.** Bloquear tudo viraria obstáculo; avisar tudo
  viraria decoração. Trava é só o indefensável.
- **"Publicar mesmo assim"** existe, como segunda ação explícita. O dono
  pode ter razão contra a regra; o que não pode é publicar sem saber.
- **A conferência roda no que está na tela**, não no que está no banco: o
  editor é campo editável e o texto corrigido ainda não passou pelo
  salvamento.
- **Link interno de verdade:** conta `href` relativo ou que aponte para uma
  página conhecida do cliente (`internal_links`), não qualquer `<a>`.
- **Palavras curtas fora da checagem de pauta:** exigir "de" e "para" no
  título transformaria a regra em loteria.
- **Número no texto é o rastro de substância** (preço, prazo, ano). Texto
  inteiro sem nenhum costuma ser o texto que serve para qualquer empresa.
- **Segunda tentativa pelo mesmo crédito** na rota de geração quando a
  trava reprova, ficando no melhor dos dois resultados. A falha foi da
  geração, não de quem pediu. Só uma repetição: insistir mais é queimar
  token num prompt que não está resolvendo.

Validado na vitrine com artigo real do banco: bloqueou a publicação, mostrou
1332 palavras, o achado e como corrigir.

Isto é também o pré-requisito do piloto automático: publicar sozinho só é
aceitável com uma trava no caminho.

## 31. Gemini no Raio X - GEO — o quarto motor, e o único de graça

Pedido do dono depois de o Google Ads travar: "teríamos alguma fonte de
busca que no momento seja free?". O Gemini é a única que faz sentido para
este módulo — e é a mais relevante para o cliente, porque responde usando a
busca do Google, a mesma base das AI Overviews e do AI Mode.

- **Camada gratuita real:** milhares de consultas com busca por mês, sem
  cartão. Nossa rodada usa 10 por análise.
- **API de "interactions"**, não a de `generateContent`: é a atual para
  busca com fundamentação, e o formato lembra o da OpenAI — um array de
  passos, com as citações em anotações `url_citation` dentro de
  `model_output`. Confirmado na documentação antes de escrever, como nos
  outros três.
- **Modelo em variável de ambiente** (`GEMINI_GEO_MODEL`, padrão
  `gemini-3.8-flash`): o Google aposenta versão a cada poucos meses.

**Limite honesto, registrado no código:** o passo `google_search_result` do
Gemini devolve o widget de sugestões em HTML, não a lista de endereços
consultados. Então `searchResultUrls` fica vazio neste motor — não por
esquecimento. Consequência: aqui não dá para dizer "a busca te encontrou e a
IA escolheu outro", que nos outros três é o diagnóstico mais acionável. A
citação, que é a métrica principal, continua sendo provada.

O placar da tela virou quatro colunas (2×2 no celular), e a ordem de
exibição passou a ser ChatGPT, Gemini, Perplexity, Claude — ordem de uso
pelo comprador. Um teste que usava "gemini" como exemplo de motor
desconhecido passou a usar "copilot": o nome virou motor de verdade.

## 32. Ficha da empresa pronta para colar

Os achados de entidade (`SEM_ENTIDADE`, `ENTIDADE_SEM_SAMEAS`,
`ENTIDADE_INCOMPLETA`) diziam "adicione sameAs" — e o cliente não sabe o que
é JSON-LD. Agora cada um traz o bloco pronto.

- **Parte do que o site já publica** (`fichaDoSite`): o nó da organização
  como veio, mais o que dá para achar no HTML — perfis de rede no rodapé
  (um por rede, o mais repetido entre páginas; post, compartilhar e perfil
  de pessoa ficam de fora), `tel:`, `<img>` que se declara logo, `og:site_name`,
  meta description. Nada do que existe se perde.
- **O cliente completa na tela** só o que o site não disse (perfis, logo,
  endereço, telefone, nome), copia e cola. Campo vazio não entra no bloco:
  "PREENCHA AQUI" colado em produção é pior que campo ausente.
- **Sem migração:** o bloco vai no fim de `fix`, depois de
  `MARCA_FICHA`; a tela separa (`separarFicha`). Auditoria antiga continua
  mostrando só o texto.
- Validado: dataknow.es (site em JS, perfis não estão no HTML → formulário
  pede); seogenome.com (Instagram e YouTube achados sozinhos no rodapé).

## 33. Motor sem chave sai da tela do Raio X - GEO

Pedido do dono: sem chave paga de ChatGPT, Gemini e Perplexity, os três não
deviam aparecer no painel. Eles já não entravam na rodada (`getProviders()`
filtra por `isConfigured()`), mas o placar mostrava as quatro colunas, três
delas com "Sem chave configurada" — uma coluna vazia no lugar mais nobre da
análise, e um lembrete de conta que ninguém vai abrir.

Agora o placar só lista motor com chave **ou** com dado gravado (rodada
antiga continua legível), e **some inteiro quando sobra um só**: com um
motor, o placar repetiria o número que o veredito já dá. As frases da tela
("Medido em Claude", "Consultando Claude") já saíam da lista de motores
ligados e passaram a ficar certas sozinhas.

Os adaptadores dos quatro continuam no código: não custam nada desligados e
basta a variável de ambiente para religar qualquer um.

## 34. Nome do cliente e a prévia no celular

Dois defeitos que só apareceram com o produto em uso:

- **O nome do blog não tinha onde ser corrigido.** Ele nasce no cadastro e
  aparece no topo do blog publicado, no compartilhamento e na barra lateral
  do painel — um "testando dataknow" digitado no primeiro dia ficava lá para
  sempre. Virou o primeiro campo de Configurações → Blog e Domínio.
- **A prévia do editor no modo celular deixava um bloco branco.** A moldura
  branca ocupava a coluna inteira e o telefone tem 390px: sobravam ~160px de
  branco à direita, que leem como página quebrada. A moldura passou a ter a
  largura do aparelho escolhido, centralizada.

## 35. Créditos fora do painel

Decisão do dono, já anunciada na seção de avaliação: quanto o cliente pode
gerar passa a ser o plano que ele assina, não um contador interno. Saíram:
o bloco "Créditos" da barra lateral, o veredito "seus créditos acabaram" da
Estratégia, o bloqueio 402 e o débito na rota de geração, e o +1 por passo
do onboarding.

A coluna `credits` continua no banco (sem migração): quando a cobrança
entrar, o saldo volta vindo do plano. O risco que isso tirava do lançamento
era concreto — a conta de teste estava com 1 crédito, e o segundo artigo
seria recusado com "no credits available".

## 36. Passo a passo do domínio, pronto para enviar ao cliente

O DNS é do cliente e ninguém entrega esse acesso a uma agência, então
conectar o blog nunca vai ser automático. O painel passou a entregar a única
coisa que resolve: o texto pronto para mandar, com o endereço já preenchido
(Configurações → Blog e Domínio → Publicar no domínio do cliente).

- Quatro passos em linguagem de quem nunca ouviu falar de CNAME, com
  "Copiar para enviar ao cliente" — o texto sai numerado, para WhatsApp.
- **Domínio raiz vira aviso, não passo.** O campo aceitava `cliente.com`, e
  apontar o endereço principal para nós substituiria o site do cliente pelo
  blog. Quando o valor salvo é raiz (`ehDominioRaiz`, com a lista de
  terminações de dois níveis: `com.br`, `co.uk`...), a tela diz isso e o
  passo a passo já usa `blog.cliente.com`.
- **"Conferir se já está no ar"** bate no endereço de verdade
  (`/api/blog/verificar-dominio`) e separa três desfechos: não respondeu
  (DNS propagando), respondeu outra coisa (falta liberar o domínio no
  projeto da Vercel), respondeu o blog. A marca que a checagem procura é o
  `generator: "Know SEO"` do blog público. Isso também conserta o
  `domain_status`, que era escrito no cadastro e nunca mais — a tela dizia
  "aguardando DNS" para sempre.

## 37. Início vira painel: tudo o que o produto sabe, numa tela

Pedido do dono: "no início, um dashboard completo e visual com tudo — SEO,
GEO, mercado, blog, perguntas, estratégia e conteúdo — para ter uma
visualização de tudo em uma página só".

A tela antiga já tinha o veredito de gargalo e a corrente em lista, mas cada
elo era só um número: nota, pautas, artigos, visitas. Quem abria o painel
via o placar e ia para outra tela descobrir o que ele significava.

### O que passou a caber na tela

Seis painéis, um por assunto, cada um com a leitura em forma própria (a
regra da seção 15 vale: a forma é a informação, não enfeite):

| Painel | O que mostra |
|---|---|
| Saúde do site | notas Google e IA nas duas réguas, faixa escrita, quantos problemas graves, "+7 desde a anterior" |
| Raio X - GEO | células por pergunta citada, quem a IA cita no lugar, motores medidos, quantos sites ela usou |
| Mercado | temas com barra dupla (seus artigos × dos concorrentes), termos na página 2 |
| Pautas | quantas esperam e as três de maior volume |
| Conteúdo | artigos no ar, últimos três com as visitas de cada um, rascunhos pendentes |
| Visitas e conversas | totais de 28 dias e as barras dia a dia |

O endereço do blog publicado entra na linha de apoio do veredito, com aviso
quando o domínio próprio ainda não foi confirmado.

### Decisões

- **O gargalo continua mandando.** A frase de cima é a mesma de antes, e o
  painel do elo travado ganha filete âmbar e a frase "É aqui que está
  travado". Alcance e conversão marcam o mesmo painel — os dois são o que o
  blog publicado devolveu.
- **Vazio é convite, não buraco.** Painel sem dado explica o que aquela
  análise faz e o link do cabeçalho vira a ação ("Auditar", "Analisar
  mercado").
- **Duas levas de consulta, não uma por painel.** A segunda leva
  (achados da auditoria, temas do mercado) depende de um id que só existe
  depois da primeira; tudo o mais vai junto no mesmo `Promise.all`.
- **`painel.tsx`** guarda `Painel`, `Numero` e `Vazio`. Painel novo no
  Início usa essas peças antes de inventar layout.

## 38. Identidade visual do cliente: logo e duas cores, num lugar só

Pedido do dono: "um local para colocar toda a identidade visual do cliente,
para sair nos blogs e nos carrosséis — logo, cor principal e secundária; até
mesmo a IA pegar as cores do logo".

Existia só "Cor principal", em Blog e Domínio. E `theme.logo_url` estava no
banco desde o primeiro dia **sem nenhuma tela que o preenchesse**.

### As decisões

- **Arquivo, não endereço do site do cliente.** Logo servido do site dele
  costuma ter proteção contra uso externo, e a capa e o carrossel são
  desenhados no servidor: precisam buscar a imagem. Vai para o balde público
  `marca` do Supabase Storage (2 MB, PNG/JPG/WEBP/SVG), caminho por blog.
- **As cores saem do logo no navegador, não da IA** (`src/lib/paleta.ts`,
  6 testes). Canvas, agrupamento em 16 níveis por canal, fundo branco e
  transparente descartados, e uma cor com saturação vence o preto do texto
  desde que apareça em 5% dos pixels lidos — logo preto com símbolo colorido
  tem a cor da marca no símbolo. Sem segunda cor no logo, a secundária é a
  principal escurecida. É instantâneo, não custa chamada de API, e o cliente
  confere as duas amostras antes de aceitar ("Usar estas cores").
- **A proporção do logo é medida no envio** e guardada em `theme.logo_ratio`:
  o satori (capa e carrossel) exige largura e altura, e não busca a imagem
  para descobrir. SVG não entra na capa nem no carrossel — nem sempre
  desenha — mas aparece normal no blog.
- **Onde a identidade sai:** topo do blog (logo no lugar do nome escrito),
  capa do artigo, slides do carrossel e botão de CTA, que passa a usar a
  cor secundária quando existe. Filete de acento na capa e no carrossel
  também vira a secundária; igual à principal, volta a ser a cor de texto.

Validado com um logo de verdade no banco: capa e carrossel renderizaram com
o logo no topo e o acento amarelo. O teste foi revertido depois (o blog do
cliente voltou sem logo).

## 39. Backlog de correção de 15/09 — 25 itens em sete blocos

Revisão externa (Claude Cowork, conta `dataknow`, testada a 371px) listou 25
defeitos. Foram atacados em blocos paralelos, cada um com teste onde havia
lógica. O que cada bloco resolveu, e o que se aprendeu:

- **Idioma (07).** O prompt forçava português do Brasil por código, e o DNA
  repetia isso em texto livre — para uma agência espanhola, 17 pautas e 3
  artigos saíram no idioma errado. `src/lib/idioma.ts`: o idioma vem do país
  do domínio, com o idioma cadastrado como reserva; a regra de estilo do DNA
  que contradiz perde, e o formulário avisa. Mesma dedução do volume de busca
  (seção 19) — TLD primeiro.
- **Mercado (08).** A tela dizia "não achamos temas em comum" com
  concorrentes brasileiros cadastrados, enquanto listava logo abaixo os
  espanhóis que o próprio Raio X descobriu. Agora o formulário já vem com
  eles.
- **Datas (01).** `formatDate` sem `timeZone` = UTC no servidor e local no
  navegador: a mesma auditoria aparecia em dois dias, e o React acusava
  hidratação (#418). Um fuso só, UTC, nos dois lados.
- **Cron (06).** A migração 0011 está aplicada em produção — a causa está
  fora do código. A rota, porém, engolia a falha: `{ok:false}` resolvido
  contava como sucesso e devolvia 200. Agora conta falha, registra no log e
  ordena os blogs.
- **Domínio (03, 04).** O link "ver no ar" usava o domínio próprio mesmo sem
  DNS: como o site do cliente responde 200 em qualquer caminho, o link
  *parecia* funcionar. `enderecoDoBlog()` só usa o domínio quando
  `domain_status` é `active`; o campo recusa apex e `www` na digitação.
- **Raio X (12, 13, 09, 10).** Markdown cru virou HTML (`src/lib/markdown.ts`,
  escapa antes de marcar); a resposta é gravada inteira; a manchete nomeia o
  motor quando só um foi medido; e imprensa deixou de ser chamada de
  concorrente — três tipos agora: plataforma, imprensa e site citado.
- **Auditoria (05, 02).** `SOFT_404`: pedimos um caminho inventado e
  comparamos com a home. dataknow.es respondia 200 com a home em qualquer
  rota e tirava 100 — agora tira 88, com o achado. O crawler ganhou
  `tituloDaPagina()` para não repetir o título da home em site feito em JS.
- **Interface (14–18, 21–25).** Passada a 371px: campos que quebram linha em
  vez de cortar, onboarding em português e responsivo, 404 próprio, "Abrir
  blog" na barra lateral, eixo do gráfico em passo regular até 100, estado
  vazio para série zerada, e a linha do tempo duplicada no DOM removida.

Duas correções que só apareceram na revisão do diff: a capa e o carrossel
agora respondem com cache de um dia, então a URL leva `?v=` derivado da
identidade (nome, cores, logo) — sem isso, trocar a marca serviria a imagem
velha; e o detector de imprensa casava por pedaço de palavra
("express**press**", "com**post**ela"), o que roubava domínios legítimos da
lista de concorrentes.

## 40. Brief de correção de 16/09 — o blog que não abria

Segunda auditoria externa, 16 tarefas. As que mudaram a arquitetura:

- **O endereço do blog nunca existiu.** `cliente.knowseo.vercel.app` é
  subdomínio de segundo nível: o certificado `*.vercel.app` cobre um nível só
  e a conexão cai no TLS, antes do HTTP. Nenhuma configuração conserta. A
  fonte de verdade virou o caminho `https://<app>/b/<slug>`, que sempre
  abre; o domínio próprio é alias, e só entra no link quando é subdomínio
  seguro **e** verificado. `/b/` e não `/<slug>`: um cliente chamado
  `login` sequestraria rota do app. Um script (`npm run test:blog`) faz GET
  real no endereço publicado — o bug durou semanas porque nada abria a URL
  que o app publicava.
- **Domínio raiz em quatro camadas.** Digitação, envio, rota de servidor e
  constraint no banco; e o tenant se recusa a servir host inseguro. A lista
  fixa de terminações (`com.br`, `co.uk`…) deixava passar `cliente.gob.es`:
  virou Public Suffix List (`tldts`). A revisão achou que o RLS deixava o
  navegador gravar `domain_status='active'` direto; a 0012 tira UPDATE e
  INSERT dessas colunas do usuário — só as rotas de servidor gravam.
- **Slug renomeável com 301** (`slugs_anteriores`, migração 0012). Slug
  antigo presente em mais de um blog não redireciona: mandar os links de um
  cliente para outro é pior que 404.
- **Fuso de quem opera, não UTC.** Cookie `fuso` detectado no navegador,
  editável em Interface; `src/lib/datas.ts` formata no servidor com fuso
  explícito (sem #418). No blog público, o fuso é o do país do domínio.
- **"Analisar" não dava sinal** porque a auditoria real leva 2–5s e o botão
  voltava ao normal no mesmo instante em que chamava `router.refresh()`, que
  não é aguardado — a tela ficava igual. Estado ocupado dura até o refresh
  terminar, trava por ref contra duplo clique e dedupe no servidor.
- **Acervo fora do idioma** marcado na leitura (`detectarIdioma`), com
  "Descartar todas" — nada apagado em silêncio.
- **Cron com registro** (`cron_execucoes`, migração 0013) e `?forcar=1`; a
  tela só promete reauditoria quando há execução registrada.
- **Relatórios** com período, comparação, PDF por `window.print()` e link
  somente leitura assinado por HMAC (`RELATORIO_SECRET`), sem migração.
- **Régua auditável:** `CHECAGENS` lista as 31 regras; a auditoria mostra o
  que passou e o que falhou, e um teste garante que nenhuma regra emite
  código fora da lista.

## 41. Plano de conteúdo: a Estratégia deixa de entregar pauta solta

Pergunta do dono: "o que essa estratégia me entrega hoje para eu fazer esses
blogs e estar ranqueando?". A resposta honesta era: uma lista de pautas boas,
não um plano. Oito keywords sem relação entre si, cada artigo competindo
sozinho contra o mercado inteiro - e, no pior caso, competindo entre si.

O que ranqueia é cobertura de tema: um artigo amplo (pilar) e vários
específicos (apoio), ligados entre si. É o silo que a agência do Daniel
Sócrates vende (seção 24) e o que faltava aqui.

### O que entrou

- **`generateContentCluster`** devolve `{tema, pilar, apoios[]}` em vez de
  uma lista plana. O prompt não pede "mais pautas": pede que cada apoio
  responda **uma pergunta distinta** dentro do tema, porque dois apoios que
  se responderiam com o mesmo artigo canibalizam um ao outro e o site fica
  pior nas duas buscas.
- **Migração 0014**: `cluster_id`, `cluster_tema` e `cluster_papel` na
  própria tabela de keywords. Tabela nova obrigaria join em toda leitura da
  Estratégia para exibir a mesma coisa. `cluster_id` nulo é o que sempre
  existiu - pauta solta continua valendo (pergunta perdida no Raio X não
  vira plano de seis artigos). O id é gerado na rota: as seis pautas entram
  num insert só e precisam compartilhar o valor.
- **Duas portas**: "Montar plano" na Estratégia (o assunto é digitado) e
  "Plano do tema" no Mercado (o assunto é a lacuna medida, e os títulos
  reais dos concorrentes vão junto no prompt). No Mercado, "Gerar pauta"
  virou "Uma pauta" e perdeu o destaque - plano é o caminho recomendado.
- **O link entre os artigos é aplicado na geração**, não sugerido na tela:
  ao escrever uma pauta do plano, a rota busca os irmãos **já publicados**
  e manda a lista como link obrigatório, pilar primeiro. Rascunho não entra:
  linkar para artigo não publicado é mandar o leitor para um 404. Sem esse
  passo o cluster seria etiqueta na interface, não silo para o Google.
- **`agruparEmPlanos`** (função pura, 5 testes) monta a leitura da tela.
  Duas regras que valem: pauta descartada sai do plano **e do total**, senão
  "2 de 6" nunca chega a "6 de 6"; e plano sem pilar continua sendo plano,
  porque o cliente pode descartar o pilar e os apoios seguem do mesmo tema.

### Compatibilidade deliberada

As colunas do plano só entram no insert quando há plano. Assim a pauta
solta continua funcionando mesmo com o deploy na frente da migração - o
contrário quebraria a Estratégia inteira por uma coluna que ainda não
existe.

### O que isto não resolve

Volume de busca continua vindo da leitura do modelo enquanto o acesso
Básico da Google Ads API não for pedido (seção 28). O plano diz **em que
ordem escrever**; ele não prova a demanda de cada apoio.

## 42. Revisão de segurança de 17/09 — sessão, HTML, CSP e isolamento

Brief externo (caixa-cinza, uma conta só) com sete itens. Todos atacados; o
teste de isolamento que o brief pedia encontrou dois furos que ele não
tinha como ver de fora, e esses eram os piores.

### S1a — o token de sessão saiu do alcance do JavaScript

O cookie `sb-…-auth-token` guarda o refresh token, que renova sozinho. Ele
era legível por `document.cookie` porque o painel tinha um client Supabase
**no navegador** - login, cadastro, troca de senha e sete formulários
falavam direto com o banco. Qualquer XSS virava sessão roubada sem prazo.

- Tudo virou Server Action: `src/app/acoes-de-conta.ts` (entrar, cadastrar,
  criar workspace, pedir e trocar senha, sair) e `src/app/(dashboard)/acoes.ts`
  (salvar artigo, DNA, marca, integrações, links internos, descartar pauta).
  `src/lib/supabase/client.ts` foi apagado: não existe mais client de
  navegador, e a chave anon saiu do bundle.
- `COOKIE_DE_SESSAO` (`src/lib/supabase/cookie.ts`) põe `httpOnly` e
  `secure` nos dois clients de servidor. O proxy **regrava** os cookies de
  sessão antigos no primeiro pedido, então quem já estava logado passa a
  HttpOnly sem precisar entrar de novo.
- `criarWorkspace` usa o usuário da sessão, não um `userId` vindo do
  formulário como antes.

### S1c — HTML de fora passa por um sanitizador só

Dos "16 dangerouslySetInnerHTML" do bundle, 5 são nossos; o resto é do
React/Next. Classificados:

| Onde | Fonte | Tratamento |
|---|---|---|
| corpo do artigo (blog público) | modelo + editor | `htmlSeguro` na leitura |
| corpo do artigo (editor) | modelo + editor | `htmlSeguro` na carga da página |
| JSON-LD do artigo | título, resumo | `jsonParaScript` - `JSON.stringify` não escapa `<`, e um título com `</script>` abria script na página do cliente |
| resposta da IA (Raio X) | modelo | já escapava antes de marcar (`markdown.ts`) |
| script de tema | constante | ganhou nonce |

`htmlSeguro` (`sanitize-html`, lista do que entra) roda também **na
gravação**: na saída do modelo, antes da trava de qualidade, e no
`salvarArtigo`. O modelo lê a web antes de escrever - texto plantado numa
página pode induzi-lo a devolver HTML com script. 9 testes com os payloads
do brief (`onerror`, `javascript:` com maiúscula e espaço, `svg onload`,
`</script>` no JSON-LD).

### S1b/S2 — CSP com nonce, em Report-Only

`src/lib/csp.ts` + `proxy.ts`: nonce novo por pedido, nos três caminhos
(painel, blog por `/b/`, blog em domínio do cliente). O Next lê o nonce do
cabeçalho do pedido - inclusive no Report-Only, conferido no código dele - e
marca os próprios scripts. O layout raiz lê o nonce para o script de tema, o
que torna as páginas dinâmicas (exigência do nonce).

`style-src` fica com `'unsafe-inline'` e sem nonce: com nonce o navegador
ignora `'unsafe-inline'`, e o painel usa `style={}` em todo lugar.

Violações vão para `/api/csp` → log da Vercel. Conferido localmente: zero
violação no painel, no blog e no artigo; um `<img onerror>` injetado de
propósito apareceu no log como `script-src-attr`. **Para passar a bloquear,
troca-se uma linha** (`CABECALHO_CSP`), depois de uma semana de log limpo.

### S4 — capa e carrossel só de artigo publicado

`acessoAoArtigo`: publicado sai para qualquer um (é o preview do WhatsApp);
rascunho só para quem é do workspace, conferido pela sessão e pela RLS.
Rascunho sai com `Cache-Control: private, no-store` - senão a primeira
visita, do dono, deixaria a cópia na CDN para qualquer um.

### S5 — cabeçalhos

`next.config.ts`: `X-Frame-Options: SAMEORIGIN` (é ele que impede
clickjacking enquanto a CSP só avisa; SAMEORIGIN porque a prévia do editor
é iframe da própria origem), `nosniff`, `Referrer-Policy`,
`Permissions-Policy`.

### S7 — teto por hora, por workspace

`src/lib/limite-de-uso.ts` conta as linhas que a própria operação grava
(artigos, pautas, perguntas, rodadas do Raio X, auditorias, análises de
mercado) na última hora, somando os blogs do workspace. Sem tabela nova.
Tetos folgados para uso real, 429 com `Retry-After` acima deles.

### S6 — o que o teste de isolamento achou (migração 0015)

Escrevendo `scripts/isolamento.mjs`, a leitura das policies mostrou:

1. **`blogs` legível por qualquer um.** A policy "public can read published
   blogs metadata" era `using (true)`, e policies de SELECT somam. Medido
   com a chave anon, sem login: a tabela inteira, dos dois workspaces,
   com `workspace_id`, marca, WhatsApp do CTA e propriedade do Search
   Console. Nada no app dependia dela - o blog público lê com o client de
   serviço. Removida, junto com a de artigos publicados.
2. **Qualquer conta entrava em qualquer workspace.** O INSERT em
   `workspace_members` só conferia `user_id = auth.uid()`. Com o
   `workspace_id` que o item 1 entregava, bastava criar uma conta e se
   inserir como `owner` na agência alheia. Agora só se entra num workspace
   que ainda não tem ninguém (`workspace_sem_membros`, security definer para
   não entrar em recursão de RLS) - exatamente o passo do cadastro.

`npm run test:isolamento` cria duas contas descartáveis, monta uma agência
completa para cada e tenta, como B, ler, alterar, apagar, plantar artigo e
se vincular ao workspace de A; tenta o mesmo sem login; confere a capa de
rascunho no app. Apaga tudo no fim e sai com código 1 se algo passar. Rode
depois de qualquer migração que mexa em policy.

### O que fica de fora, e por quê

- A chave anon continua existindo nas variáveis de ambiente (os clients de
  servidor usam) - só saiu do navegador.
- Revisão linha a linha de todas as policies das tabelas 0002-0013: as de
  membro seguem o mesmo padrão da 0001 e o teste de isolamento cobre as
  principais. As que não têm policy nenhuma (`google_integration`,
  `cron_execucoes`) ficam fechadas para usuário por construção.

## 43. Conta nova nasce em liberação (migração 0016)

Nota de segurança do app dada ao dono em 18/09: 75/100, e o primeiro item
para subir era o cadastro aberto. Qualquer pessoa criava conta e gerava
artigos, pautas e rodadas do Raio X na conta da Anthropic do dono - e o
teto por hora da seção 42 vale por conta, então 50 contas eram 50 tetos.

- `workspaces.liberado` (padrão `false`; as contas que já existiam foram
  marcadas `true` na própria migração, são do dono).
- **Conta em liberação usa o que não custa IA**: auditoria, mercado,
  configurações, blog. `barrarSemLiberacao` fica só nas rotas que gastam
  IA ou API paga: artigo, pautas, perguntas e rodada do Raio X, carrossel e
  Google Meu Negócio. O robô semanal pula essas contas.
- **O usuário não se libera sozinho.** INSERT e UPDATE em `workspaces`
  passam a valer só para as colunas que o app grava (`id, name, slug` no
  cadastro; `name, onboarding_steps` depois). Mesmo padrão da 0012: o
  Supabase concede a tabela inteira, e permissão de tabela vence revoke de
  coluna - por isso tira-se da tabela e devolve-se por coluna.
- Aviso no topo do painel enquanto a conta não é liberada, com o contato
  de vendas (`NEXT_PUBLIC_CONTATO_VENDAS`) quando existe. Sem ele, o
  primeiro "Escrever artigo" seria a primeira notícia e soaria como defeito.
- `liberado !== false`, não `!liberado`: com o deploy antes da migração a
  coluna não existe, e travar todo mundo seria pior que deixar passar.
- O teste de isolamento ganhou três linhas: conta nova nasce em liberação,
  não se libera mudando a própria conta, e não nasce já liberada.

**Como liberar:** Supabase → Table Editor → `workspaces` → marcar
`liberado` na linha do cliente. Quando a cobrança existir, é o webhook de
pagamento que marca.

## 44. Blog numa pasta do site do cliente, e o caminho de volta ao site

Pedido do dono: o blog "vinculado" ao site do cliente, "os dois juntos".
Eram duas coisas: o blog morar no endereço do cliente e o blog levar ao site.

### O caminho de volta (`src/components/blog-publico.tsx`)

O blog não tinha nenhum link para o site da empresa. Agora o topo tem "Ir
al sitio web" (no idioma do blog) e o rodapé leva o domínio. O site vem de
`siteDoCliente()`: a pasta, senão o domínio comprado do subdomínio
(blog.cliente.com → cliente.com), senão o primeiro domínio da marca. Sem
nenhum, sem link - inventar seria pior.

### Blog na pasta: cliente.com/blog (migração 0017, `src/lib/pasta.ts`)

A pasta é o formato que mais ajuda o SEO do cliente: o Google trata como
parte do site. O subdomínio continua existindo, para sites que não passam
pelo Cloudflare (Wix, Squarespace, Shopify).

Como funciona: o cliente instala um Worker do Cloudflare (plano grátis) com
o código que o painel gera. O Worker encaminha só `/blog*` para
`<app>/pasta`, com o cabeçalho `x-knowseo-pasta` dizendo de qual pasta
veio. O proxy só atende se esse valor for exatamente o `pasta_url` de um
blog; qualquer outro valor é 404. A base dos links vira a pasta, então o
visitante continua em cliente.com/blog. Depois do "Conferir se já está no
ar" (`pasta_status = 'active'`), canonical, sitemap e JSON-LD passam para a
pasta - e o endereço antigo `/b/<slug>` aponta o canonical para ela, para o
Google juntar a força no domínio do cliente.

Armadilhas encontradas e tratadas, cada uma com teste:

- **HSTS da Vercel** vale para o domínio e TODOS os subdomínios por 2 anos.
  Repassado pelo Worker, derrubaria subdomínio do cliente sem https. O
  Worker remove HSTS e Set-Cookie da resposta, e não manda o cookie do site.
- **Slug no Worker criaria loop**: renomear o blog faria o 301 do slug
  antigo voltar para a pasta. O Worker não leva slug; o blog é achado pelo
  endereço da pasta.
- **Caminhos relativos iriam para o servidor do cliente**: `/_next`, capa
  `/api/og` e `/api/track`. `assetPrefix` absoluto na produção
  (`next.config.ts`), capa e rastreio com `origemDoApp()`, rastreio em
  `no-cors` sem Content-Type (evita a pré-checagem de CORS que a rota não
  responde), e `Access-Control-Allow-Origin` explícito em `/_next/static`
  para a fonte - a Vercel já mandava, `next start` não.
- **CSP**: com o blog na pasta, `'self'` é o site do cliente; o app entra em
  style/font/img/connect-src, e o relatório de violação vai para o app.
- **A regra de segurança de sempre** (o site do cliente nunca é substituído)
  em quatro lugares: validação na digitação, rota de servidor, constraint
  no banco (conferida: `https://dataknow.es/` foi recusado) e o Worker, que
  repassa intocado tudo o que está fora da pasta - mesmo com a rota do
  Cloudflare cadastrada larga demais.
- **Bug pego pelo teste antes de sair**: o gerador lia o caminho de um campo
  inexistente e o Worker saía com a pasta vazia, repassando tudo ao site do
  cliente. O teste carrega o código gerado como módulo e o executa com um
  fetch simulado - testar uma cópia não provaria nada.

Validação ponta a ponta: um "site do cliente" local rodando o mesmo código
do Worker contra o app em modo produção. Estilo, as 4 fontes, capa, links
que ficam na pasta, visita gravada com o caminho da pasta, canonical e
sitemap depois da confirmação, barra no fim do endereço, artigo inexistente
em 404, zero violação de CSP.

## 45. Autor e datas nos artigos; textos que prometiam demais (migração 0018)

Dois itens da revisão de 18/09 (nota de diretor de SEO/GEO):

**Autor e datas (E-E-A-T).** O artigo não dizia quem escreveu nem quando.
- `blogs.autor` (jsonb: nome, cargo, bio, perfil), gravado só pela coluna
  (`grant update (autor)`, padrão da 0012). Validação em `src/lib/autor.ts`:
  tudo vazio remove; com qualquer campo, nome obrigatório; perfil só https.
  Configurado em Configurações > Marca, "Quem assina os artigos".
- No artigo: assinatura abaixo do H1 (autor, "publicado", "atualizado" com
  `<time datetime>`) e quadro "Sobre o autor" no fim, no idioma do blog e no
  fuso do país do domínio. "Atualizado" só aparece com 24h ou mais depois da
  publicação: correção feita na hora de publicar não é atualização.
- JSON-LD: `author` vira `Person` com `jobTitle`, `description` e `sameAs`
  (o perfil) quando há autor; senão continua `Organization`. `publisher` com
  a URL do site do cliente e o logo da marca. OG: `article:published_time`,
  `modified_time`, `author`.

**Idioma da página.** `<html lang>` era pt-BR em todo blog, inclusive nos
em espanhol. O proxy passa o blog no cabeçalho `x-blog-host`; o layout lê e
usa `localeDoBlog` (es-ES, es-MX..., pt-BR, pt-PT, en). `resolveBlogByHost`
em `cache()` para o layout e a página não consultarem duas vezes. Datas do
blog público formatadas no mesmo locale.

**Textos que prometiam demais.**
- Estratégia dizia "volume medido" sem nenhuma palavra com volume (a conta
  Google Ads ainda não tem acesso básico). Agora diz que volume não está
  conectado e que dificuldade e oportunidade são leitura da IA; a frase
  antiga volta sozinha quando existir volume.
- Início dizia "Nada travado" quando o Raio X nunca tinha rodado. Agora
  aponta o Raio X como o que falta saber.

Conferido local: autor temporário no DataKnow (assinatura, quadro, JSON-LD
Person com sameAs, OG author), removido depois; blog em espanhol com
`lang="es-ES"` e data "17 sept 2026"; blog em português com pt-BR; painel
continua pt-BR.

## 46. Artigo no formato que a IA cita (migração 0019)

A partir dos 7 pilares do SEO semântico (material de 18/09): o gerador
cobria resposta direta no primeiro parágrafo, mas não o resto.

- **Regras novas no prompt** (`brand-prompt.ts`): a maioria dos H2 é a
  pergunta do leitor, e o primeiro parágrafo depois de cada um responde em
  1-2 frases que se entendem sozinhas (é o trecho que a IA recorta). Tabela
  HTML quando há comparação real. Dado de terceiros com a fonte nomeada.
  Seção final de perguntas frequentes, com título fixo por idioma
  (`TITULO_FAQ`), 3 a 5 H3 com resposta curta.
- **Dados e casos reais** (`brand_dna.provas`, campo novo no DNA): o que só
  a empresa tem. O artigo usa como experiência própria e nunca inventa
  número - sem o campo preenchido, não há caso nenhum no texto.
- **Schema FAQPage lido do próprio HTML** (`lib/artigo/faq.ts`): se o
  cliente edita a pergunta no editor, o schema acompanha; artigo antigo
  sem a seção não ganha schema. Mínimo de 2 pares. O Google só mostra FAQ
  como resultado rico para governo e saúde desde 2023; o schema é para as
  IAs, que extraem pergunta e resposta prontas.
- **Tabela no celular**: embrulhada numa caixa com rolagem própria na
  renderização - a página nunca rola para o lado.

Conferido com um artigo gerado de verdade (DataKnow, "agencia de marketing
o equipo interno para una pyme", 90 s): 6 de 8 H2 em pergunta, 1 tabela
com `th scope="col"`, os dois dados reais usados, dado do INE com a fonte
citada, 4 perguntas frequentes lidas pelo schema. Publicado por um minuto
no blog de teste para ver a tabela no celular (375 px: tabela rola dentro
da caixa, página não) e o FAQPage no HTML; artigo e visitas apagados.
Artigos já publicados não mudam: as regras valem para os novos.

## 47. "Ainda sem resposta" mentia quando faltava liberar o domínio

blog.dataknow.es: CNAME criado e correto, e o painel dizia "o CNAME ainda
não foi criado". A checagem só batia em https://; como o domínio ainda não
estava adicionado no projeto da Vercel, não há certificado, o TLS falha
antes de qualquer resposta e `fetchComStatus` devolve null - o mesmo null
de um domínio inexistente. A agência ficava esperando propagação de um
registro que já estava propagado.

Agora a evidência é o DNS (`node:dns/promises` lookup), não a resposta
HTTP: sem registro = "ainda não apareceu no DNS"; com registro e sem blog =
"o cliente já fez a parte dele, falta liberar na Vercel (Settings >
Domains)". Cobre também o DNS que achata CNAME em A.

## 48. Trocar o endereço do app por um domínio próprio

Preparado antes da troca, para que ela seja uma variável de ambiente:

- `NEXT_PUBLIC_APP_DOMAIN` já manda em tudo que é endereço absoluto: capa
  do artigo, rastreio, CSP, `assetPrefix`, endereço público de cada blog
  (/b/), redirect do Google e validação da pasta.
- **O endereço antigo passa a redirecionar** (proxy): quando o host da
  requisição é o de produção da Vercel e `NEXT_PUBLIC_APP_DOMAIN` já é
  outro, responde 301 para o novo. Hoje os dois são iguais e a regra não
  faz nada; no dia da troca ela liga sozinha e nenhum link indexado morre.
  Preview deployment não entra (host diferente do de produção).
- **Domínio do cliente nunca pode ser um endereço nosso**:
  `isSafeCustomDomain` passa a recusar o próprio app e qualquer subdomínio
  dele. Importa no dia em que existir wildcard no domínio próprio - sem a
  guarda, o blog de um cliente responderia num endereço nosso.
- O crawler se apresenta com o domínio atual, não com o fixo.

Fora do código, no dia da troca: domínio adicionado na Vercel (apex + www),
variável trocada, Supabase (Site URL e lista de redirect) e Google Cloud
(URI de callback) apontando para o novo endereço.

## 49. Domínio do cliente liberado sozinho (API da Vercel)

O buraco do fluxo: o cliente criava o CNAME e alguém da agência tinha que
entrar na Vercel e adicionar o domínio no projeto. Quem pulava esse passo
via "não responde" e "sem cadeado" sem nenhuma pista - foi o que travou
blog.dataknow.es, que chegou a ficar com um redirect preso da própria
Vercel para o endereço do app.

`src/lib/vercel.ts` fala com a API (`VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, e
`VERCEL_TEAM_ID` em conta de time):

- Salvar o domínio em Configurações > Blog já **adiciona o domínio ao
  projeto**. Não existe mais passo manual.
- "Conferir se já está no ar" pergunta à Vercel o que falta e devolve o
  **registro exato que ela quer para aquele domínio** - inclusive o destino
  novo (`...vercel-dns-017.com`) e o TXT de posse quando o domínio já está
  em outra conta. O passo a passo que a agência copia usa esse valor; antes
  era um valor fixo no código, que já estava velho.
- Quatro respostas em vez de duas: esperando o DNS do cliente / emitindo o
  certificado / no ar / travou (com o motivo da Vercel escrito na tela).
- Sem token configurado tudo isso fica desligado e vale a checagem antiga
  por DNS (seção 47). Ambiente local segue funcionando sem token.

A prova de "no ar" continua sendo o blog responder com o nosso generator -
a Vercel dizer que está tudo certo não é o mesmo que a página existir.
