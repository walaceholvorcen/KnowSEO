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

- Os concorrentes sugeridos vêm do **Radar GEO** — domínios realmente
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
