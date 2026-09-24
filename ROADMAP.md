# Know SEO — Roadmap

Documento vivo. Última revisão: 24/09/2026.

> A marca está em migração de **Know SEO** para **Ranknow**. O código, os
> domínios e esta documentação ainda usam o nome antigo; a troca é um item
> do "Próximo", não um detalhe de texto.

**Onde o produto está hoje, em uma linha:** está no ar, com um blog de
cliente real em domínio próprio (`blog.dataknow.es`), rodando auditoria e
Raio X sozinho toda semana — e sem nenhuma forma de cobrar por isso.

---

## ✅ Pronto, testado e em produção

**Base do produto**
- Auth (Supabase) com cadastro, login, **recuperação de senha** e troca de
  senha; sessão validada e erro traduzido (nada de inglês na cara do cliente)
- Workspace + onboarding de 5 passos
- Multi-cliente de verdade: a barra lateral troca de blog e a escolha fica
  gravada. O painel não é mais monocliente
- Liberação de conta: workspace novo não publica em domínio de cliente
  antes de ser aprovado
- Teto de uso por hora nas operações que gastam IA ou busca na web
- DNA da Marca (com provas e casos reais) alimentando todo prompt
- Claro/Escuro/Sistema, telas de carregamento e de erro no vocabulário da casa

**Onde o blog do cliente mora** — o ponto que a avaliação de setembro
apontava como o mais grave, resolvido por três caminhos:
- Subdomínio do cliente (`blog.cliente.com`) — **no ar hoje**
- Pasta do site do cliente (`cliente.com/blog`) via Worker do Cloudflare,
  que é o modo que transfere autoridade para o domínio principal
- Provisionamento automático do domínio: a agência digita o endereço, a
  plataforma libera sozinha na Vercel, confere o DNS e diz em que pé está.
  Ninguém do nosso lado abre painel de infraestrutura
- Trava dura: domínio raiz e `www` nunca são servidos pelo blog

**SEO técnico dos blogs**
- `sitemap.xml`, `robots.txt`, `llms.txt` e `feed.xml` por tenant, guardados
  na borda e respondendo em ~0,2s
- JSON-LD `Article` + `Organization`, e `FAQPage` quando o texto tem
  perguntas frequentes
- Autor com nome, cargo, bio e perfil (E-E-A-T); datas de publicação e
  atualização
- URL canônica, Open Graph e Twitter Card com capa gerada na cor da marca
- Artigo escrito no formato que a IA cita: H2 que é pergunta de leitor,
  resposta autossuficiente logo abaixo, tabela quando compara, fonte
  terceira nomeada, FAQ no fim
- Página de artigo respondendo em ~0,3s (era 0,9 a 2,0s)

**Auditoria do site do cliente**
- 21 regras de rastreamento, indexação, on-page, conteúdo e entidade
- Nota separada para Google e para IA, com histórico e evolução
- Cada achado traz problema, impacto, evidência e correção
- Jornada do site: o que mudou desde a auditoria anterior

**Raio X - GEO (citação em IA)**
- Detector determinístico que separa "a IA citou a marca" de "a marca só
  apareceu nos resultados de busca"
- Quatro motores implementados atrás da mesma interface: Claude, OpenAI,
  Gemini e Perplexity
- Pergunta perdida vira pauta: o laço entre medir e produzir
- Rodada semanal automática

**Conteúdo**
- Geração com Claude Opus 5, saída estruturada, prompt caching
- **Trava de qualidade antes de publicar**: as regras da auditoria rodando
  no texto recém-escrito. Dois níveis — "trava" bloqueia o botão, "aviso"
  informa e libera
- Editor com autosave do rascunho, atalho de salvar e aviso ao sair
- Linkagem interna automática lendo o sitemap do cliente (com proteção
  contra SSRF, 14 casos testados)

**Relatórios**
- Corrente do trabalho: diagnóstico → citação em IA → produção → alcance →
  conversas, os cinco elos na mesma tela
- Leitura do período escrita por regra (nunca por IA), com próximo passo
- Visitas por dia, e a fração honesta ("2 de 9 visitas") abaixo de 30
  visitas, onde porcentagem seria falsa precisão
- Visitas e conversas por artigo

**Operação e segurança**
- RLS + permissão por coluna no banco; o navegador não fala com o Supabase
- CSP publicada (em modo aviso), cabeçalhos de defesa, HTML de artigo
  sanitizado por lista do que entra
- Cron semanal reauditando e refazendo o Raio X, com registro de execução
- 382 testes, `tsc` e `eslint` limpos

---

## 🟡 Feito no código, sem prova no mundo

| Item | O que falta |
|---|---|
| Raio X com 4 motores | Na prática só o Claude rodou: 75 checagens, todas nele. O Gemini está instalado, mas a cota do Google devolve 429 |
| Blog em pasta do cliente | Construído e testado; nenhum cliente usa ainda (o único no ar é subdomínio) |
| Mercado e Google Meu Negócio | Prontos, mas escondidos do painel de propósito, para a interface não prometer o que o dado não sustenta |
| CSP | Publicada em modo aviso. Falta trocar uma linha e observar |

---

## 🔴 Bloqueado por credencial de terceiro

| Item | Bloqueio |
|---|---|
| Volume de busca real nas pautas | Acesso Básico da API do Google Ads nunca foi pedido. Sem ele, dificuldade e oportunidade são leitura de modelo |
| Impressão, posição e clique reais | Search Console sem propriedade verificada. Hoje só enxergamos as visitas que nós mesmos contamos |
| Gemini no Raio X | Cota do Google Studio em 429 desde a instalação da chave |

---

## 🎯 Próximo, na ordem

1. **Cobrança.** É o único item que separa o produto de um negócio. Sem
   checkout não há cliente pagante — e `plan` e `credits` já existem no
   banco esperando.
2. **Landing page + a marca Ranknow.** Hoje a raiz do site só redireciona
   para o login: o produto que vende SEO não tem uma única página
   indexável. E os metadados ainda estão em espanhol, de uma versão antiga.
3. **Search Console conectado.** É o que transforma "12 visitas" em
   "aparecemos 4 mil vezes e subimos da página 3 para a 1".
4. **Agendamento e piloto automático.** `scheduled_at` existe no banco e
   nada o usa. É o que torna o produto automático de fato.
5. **Atualizar artigo antigo.** O que segura posição depois do mês 6.
6. **CSP de aviso para bloqueio.** Uma linha, com você por perto para testar.

---

## 💡 O diferencial: citação em IA

**A tese:** o concorrente vende GEO no marketing e não tem uma tela de GEO
no produto. É promessa sem entrega.

**A pergunta que o produto responde:**
> "Quando alguém pergunta pro ChatGPT sobre o meu setor, a minha empresa
> aparece?"

| Peça | Estado |
|---|---|
| Conteúdo estruturado para ser citado (`llms.txt`, JSON-LD, FAQ, formato do texto) | ✅ Feito |
| Detector de citação + painel + adaptador de provedor | ✅ Feito |
| Rodando com cliente real | ✅ 7 rodadas, 75 checagens |
| Mais de um motor de verdade | 🟡 Só Claude na prática |
| Rodada semanal automática | ✅ Feito |
| Prova de ROI por artigo | ✅ Visitas e conversas por artigo no relatório |

**O número honesto de hoje:** em 75 checagens, a marca do cliente foi citada
**zero vez**. Isso não é falha da medição — é exatamente o diagnóstico que
justifica o produto, e é o número que precisa se mover.

---

## 🐛 Bugs encontrados e corrigidos

Registro do que já quebrou, para não repetir:

- **Blog do cliente redirecionando para o painel por horas** — uma regra
  nossa lia `VERCEL_PROJECT_PRODUCTION_URL`, e a Vercel repontou essa
  variável para o domínio do cliente assim que ele foi adicionado. Lição:
  variável da plataforma não é verdade sobre o nosso produto
- **Painel dizendo "CNAME não existe" quando existia** — conferíamos por
  https, que falha antes de o certificado sair. Agora consulta o DNS
- **Gemini falhando calado** — 10 de 10 perguntas sem resposta e sem erro na
  tela. O erro agora aparece, com o motivo (cota)
- **Contraste invertido** em 13 arquivos (texto claro no fundo claro), um
  deles vazando para o blog público
- **Blog de cliente dava 404** — a porta chegava percent-encoded (`%3A`)
- **Erro falso de RLS ao criar workspace**
- **`middleware.ts` → `proxy.ts`** — convenção renomeada no Next.js 16
- **Pasta `_sites` não roteável** — prefixo `_` é pasta privada no Next
- **Blogs novos nascendo roxos** — default antigo no banco

---

## 📌 Decisões tomadas

- **Mercado:** Espanha primeiro (ticket em EUR, merchant of record resolve
  imposto, ~15k agências). Colômbia entra depois com o mesmo código
- **O site institucional do cliente nunca é tocado.** O blog vive num
  subdomínio que ele apontou ou numa pasta do site dele. Nunca no domínio
  raiz. Se uma implementação abrir a menor chance disso, ela não entra
- **Nada de instrução de DNS para o cliente quando a culpa é nossa.** Se dá
  para automatizar, automatiza
- **Medição e opinião são ditas com nomes diferentes** em toda tela
- **Blog do cliente segue o modo escuro do visitante**
- **Mercado e Google Meu Negócio ficam no código, fora da interface**, até
  terem dado que os sustente
