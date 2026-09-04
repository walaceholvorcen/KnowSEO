# Know SEO — Roadmap

Documento vivo. Atualizado conforme construímos.

---

## ✅ Pronto e testado

**Base do produto**
- Auth (Supabase) + workspace + onboarding de 5 passos com créditos por progresso
- Multi-tenant: cada cliente tem blog em subdomínio próprio (`cliente.dominio.com`)
- DNA da Marca → alimenta todo prompt de geração (com prompt caching)
- Estratégia: IA sugere keywords com funil, dificuldade e oportunidade
- Geração de artigo (Claude Opus 5, structured output) — **código pronto, nunca executado**
- Editor com WYSIWYG leve + campos de SEO
- Blog público do cliente com CTA configurável (link ou WhatsApp)
- Analytics de primeira parte (pageview, clique em CTA, clique em WhatsApp)
- Relatórios sem depender de Google Analytics
- Marca Know SEO, paleta azul marinho, dark mode (Claro/Escuro/Sistema)

**SEO técnico dos blogs**
- `sitemap.xml` por tenant
- `robots.txt` por tenant (crawlers de IA liberados de propósito)
- `llms.txt` — índice em markdown para ChatGPT/Claude/Perplexity
- `feed.xml` (RSS)
- JSON-LD (schema `Article`) em cada artigo
- URL canônica (evita conteúdo duplicado entre subdomínio e domínio próprio)
- Capa de artigo gerada automaticamente com a cor da marca, que serve
  também de preview ao compartilhar (Open Graph + Twitter Card)

**Linkagem interna automática**
- O cliente cola a URL do site e a gente lê o sitemap dele (segue
  sitemap index, cai no `robots.txt` quando não há caminho padrão)
- Busca título e meta description das primeiras 60 páginas
- Salva com upsert — rodar de novo atualiza, não duplica
- Proteção contra SSRF (bloqueia localhost, IPs privados, link-local,
  protocolos não-http) — testada em 14 casos
- Medido: 200 páginas em ~5s

---

## 🔴 Bloqueado

| Item | Bloqueio |
|---|---|
| Testar geração de artigo de ponta a ponta | Falta `ANTHROPIC_API_KEY` — conta da empresa sem acesso ao console |
| Rastreador de citações em IA (o diferencial) | Mesma chave |

**Caminhos:** pedir a chave a quem administra a conta da empresa, ou abrir
conta pessoal com pay-as-you-go (mínimo ~$5).

---

## 🎯 Próximo

1. **Deploy** (Vercel + domínio wildcard)
   Sair do localhost. Precisa: conta Vercel (login com GitHub) e um
   domínio. Sem isso não dá pra mostrar pra ninguém.

3. **Agendamento de publicação**
   O schema já tem `scheduled_at`, falta o cron que publica.

4. **Piloto automático**
   Escolher pauta + gerar + publicar sozinho nos horários definidos.
   É o que torna o produto "automático" de fato. (Precisa da chave.)

5. **Cobrança** (Paddle ou Lemon Squeezy)
   Sem isto não é negócio. `plan` e `credits` já existem no schema.

6. **UI multi-blog**
   O schema já suporta N blogs por workspace; a interface usa sempre o
   primeiro. É o que destrava o caso de uso de agência.

---

## 💡 O diferencial: Motor de Visibilidade em IA

**A tese:** o Automarticles vende GEO no marketing e não tem uma única
tela de GEO no produto. É promessa sem entrega — e é onde a gente ataca.

**A pergunta que o produto responde:**
> "Quando alguém pergunta pro ChatGPT sobre o meu setor, a minha empresa
> aparece?"

**As três peças:**

| Peça | Estado |
|---|---|
| Conteúdo estruturado para ser citado por IA (`llms.txt`, JSON-LD, robots) | ✅ Feito |
| Banco + detector de citação (17 testes) + dashboard + adaptador de provedor | ✅ Feito |
| Ligar o provedor real e rodar o primeiro cliente | ⬜ Só falta a chave |
| Cron semanal automático | ⬜ Depende do deploy |
| Prova de ROI por artigo ("este artigo gerou 6 conversas no WhatsApp") | 🟡 Dados já são coletados, falta a tela |

**Como está montado:** toda a lógica que decide se a marca foi citada é
determinística e testada (`src/lib/citation.ts`). A chamada à IA está
isolada atrás de uma interface (`src/lib/ai-visibility/provider.ts`), então
trocar ou adicionar provedor não toca em detector, banco nem UI. Sem chave
configurada, a tela funciona e os botões retornam aviso claro (503).

**Por que essa é a aposta:**
- Vende medo ("estou sumindo da IA"), não desejo — converte mais rápido
- Vira criativo de anúncio pronto, que é a força do founder
- Dá um número que muda todo mês → justifica a renovação
- O concorrente não copia rápido sem admitir que vendia GEO sem ter GEO

---

## 🐛 Bugs encontrados e corrigidos

Registro do que já quebrou, para não repetir:

- **Blog de cliente dava 404** — a porta chegava percent-encoded (`%3A`)
  e o subdomínio nunca era extraído. Nenhum blog funcionaria em produção.
- **Erro falso de RLS ao criar workspace** — o Postgres tentava reler a
  linha recém-criada antes de o usuário virar membro dela. Resolvido
  gerando o id no cliente e não pedindo a linha de volta nesse passo.
- **Home do blog do cliente com título "Know SEO"** em vez do nome dele.
- **`middleware.ts` → `proxy.ts`** — convenção renomeada no Next.js 16.
- **Pasta `_sites` não roteável** — prefixo `_` é pasta privada no Next.
- **Blogs novos nascendo roxos** — default antigo no banco.

---

## 📌 Decisões tomadas

- **Mercado:** Espanha primeiro (ticket em EUR, merchant of record resolve
  imposto, ~15k agências). Colômbia entra depois com o mesmo código.
- **Blog do cliente segue o modo escuro do visitante.** Se preferir travar
  sempre em claro, é 1 linha.
- **Sem landing page ainda** — validação de oferta ficou para depois.
