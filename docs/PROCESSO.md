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

## 20. Radar GEO — o dia em que o diferencial parou de mentir

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

## 22. Radar GEO em segundo plano, três assistentes, e a auditoria que se acompanha

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
  `vercel.json`) reaudita o último site auditado e refaz o Radar GEO de
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
- Crédito por rodada do Radar GEO. Continua sem débito, e agora é a
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

O Radar GEO ainda abria com "no seu lugar apareceu agencies.semrush.com" —
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
