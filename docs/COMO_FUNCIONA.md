# Como cada módulo funciona — jornada, dado real e próximos passos

> Complementa o [PROCESSO.md](./PROCESSO.md) (que conta decisões e bugs).
> Este arquivo existe para explicar **a mecânica**: o que acontece quando
> alguém clica em cada botão, de onde vem cada dado, e o que falta para
> cada módulo virar produto maduro. Serve para você entender e para
> explicar a outra pessoa sem abrir o código.

Última atualização: setembro/2026

---

## 1. Geração de Conteúdo — "Escrever artigo"

**Jornada:**
1. Você clica em "Escrever artigo" numa pauta, na tela Estratégia.
2. O sistema busca três coisas: a keyword escolhida, o **DNA da Marca** do
   blog, e a lista de **links internos** mapeados em Configurações.
3. Cria o artigo no banco já como "gerando" — por isso você consegue
   navegar até ele e ver o carregamento em vez de ficar preso numa tela.
4. Monta um prompt único: o DNA da marca vira a instrução de sistema (quem
   escreve, para quem, em que tom, o que não pode dizer), e o pedido é
   "escreva 900–1400 palavras otimizado para esta keyword, linkando de 2 a
   4 dessas páginas internas se fizer sentido".
5. Envia para o Claude Opus 5 pedindo **saída estruturada** (não é o
   modelo "escrevendo livre" — é um formato fixo que obriga a resposta a
   vir com título, slug, meta título, meta descrição, resumo e corpo em
   HTML já separados). É isso que garante que todo artigo sai com a mesma
   estrutura.
6. Grava o resultado, debita 1 crédito do workspace.

**De onde vem o dado:** 100% gerado na hora pelo Claude, a cada clique.
Nada é reaproveitado de artigo anterior, exceto o DNA da marca (que é
cacheado para sair mais barato).

**O que falta para evoluir:**
- Trava de qualidade antes de publicar (contagem de palavras, H2s, link
  interno mínimo) — hoje um artigo ruim pode ir ao ar sem ninguém avisar.
- Agendamento de publicação (campo já existe no banco, falta o robô que
  publica sozinho no horário certo).
- Piloto automático: escolher pauta, gerar e publicar sem intervenção.

---

## 2. Auditoria de SEO

**Jornada:**
1. Você digita uma URL. O sistema lê `robots.txt`, procura o `sitemap.xml`
   (segue sitemap-index se houver) e junta até 25 páginas.
2. Baixa o HTML de cada página (6 por vez, em paralelo) e extrai 11
   sinais: título, meta description, canonical, H1/H2, imagens sem texto
   alternativo, contagem de palavras, links internos, tipos de dado
   estruturado (JSON-LD).
3. Roda 21 regras em cima desses sinais.
4. Calcula duas notas: Google (tudo, menos a categoria de IA) e IA
   (prontidão para ser citado por ChatGPT e afins).

**De onde vem o dado:** direto do HTML público do site, ao vivo, a cada
auditoria. **Nenhuma IA envolvida** — é por isso que funciona sem a chave
da Anthropic configurada.

**O que falta para evoluir:**
- Ligar cada achado a uma ação nos outros módulos ("sem `llms.txt`" →
  botão "Habilitar Visibilidade IA").
- Histórico comparativo entre auditorias (hoje mostra a última; dá para
  mostrar evolução mês a mês).

---

## 2b. Análise de Mercado — a etapa antes da pauta

**Jornada:**
1. Você aponta de 2 a 4 concorrentes diretos. A tela já sugere os domínios
   que o Raio X - GEO viu sendo citados no lugar da sua marca.
2. O sistema lê o sitemap público de cada um e pega o título das primeiras
   60 páginas — o mesmo crawler da linkagem interna, sem login e sem API.
3. As suas páginas não são rastreadas de novo: reaproveita o que a
   linkagem interna já leu.
4. Extrai os temas de cada título (pares de palavras, descartando palavras
   vazias) e conta quantos artigos cada lado publicou sobre cada tema.
5. Se o Search Console estiver conectado, soma uma segunda camada: termos
   em que o Google já mostra o seu site.

**O que a tela mostra:**
- **Onde você já quase ganha** — termos em que você aparece na página 2
  (tem demanda e relevância, falta empurrão) ou aparece na primeira página
  e ninguém clica (o problema é o título, não o conteúdo).
- **Onde o mercado escreve** — uma barra por tema com quantos artigos são
  seus e quantos são deles, mais os títulos reais que eles publicaram.
- Cada tema tem "Gerar pauta", que leva o tema e os exemplos reais para a
  Estratégia.

**De onde vem o dado:** cobertura é lida ao vivo do sitemap dos
concorrentes; a camada de busca é do Search Console. **Nenhuma IA no
cálculo** — a IA só entra depois, quando você pede a pauta.

**A limitação que precisa ser dita ao cliente:** isto conta **artigos
publicados**, não volume de busca. Mostra o que o mercado achou que valia
escrever — bom para decidir pauta, e honesto porque não inventa número.
Volume de busca real só com a DataForSEO ligada.

**O que falta para evoluir:**
- Histórico entre rodadas (a lacuna diminuiu depois que publicamos?).
- Avisar quando o concorrente apontado é portal de notícia, que polui os
  temas.

---

## 3. Estratégia — de onde vêm as pautas

**Jornada:**
1. Você clica "Buscar pautas". O sistema pega o DNA da marca e a lista de
   keywords já sugeridas ou descartadas (para não repetir).
2. Pede ao Claude 8 ideias novas, em saída estruturada: keyword, título
   sugerido, etapa de funil, dificuldade estimada, nota de oportunidade.
3. Se a DataForSEO estiver configurada (hoje não está), o sistema busca o
   volume de busca **real** dessas mesmas keywords e substitui a
   estimativa.

**De onde vem o dado:** a keyword, o título e a etapa de funil são gerados
pelo Claude a cada clique. Com o **Planejador de Palavras-chave do Google
Ads** ligado, o volume de busca passa a ser medição do Google — a linha da
pauta mostra "1.900 buscas por mês na Espanha", com o país sempre visível
para você conferir que é o mercado certo.

**O que continua sendo opinião, e a tela diz isso:** a "dificuldade" e a
"oportunidade" seguem sendo leitura qualitativa da IA, numa linha separada
que começa com "Leitura da IA:". Não foram substituídas de propósito — o
Google Ads mede **concorrência de anunciantes** (quantos pagam por aquele
termo), que não é a mesma coisa que dificuldade de ranquear sem pagar.
Quando existe, esse número aparece com o nome certo, ao lado do volume.

**Sem campanha ativa na conta do Google Ads**, o volume vem em faixas
aproximadas em vez do número exato. Continua sendo medição do Google, e
vale dizer isso a quem for vender.

**O que falta para evoluir:**
- Deixar o Google propor as keywords, não só medir as da IA: a mesma
  chamada já devolve as sugestões do próprio Google com volume.
- Agrupar keywords por cluster de tema, em vez de lista solta.

---

## 4. Visibilidade em IA — de onde vêm as perguntas, como analisa

**Perguntas:** você clica "Gerar perguntas". O sistema manda ao Claude a
descrição do negócio e o público-alvo, pedindo 15 perguntas que **um
cliente em potencial faria a um assistente de IA antes de contratar** —
não são keywords de SEO, são frases naturais ("estou procurando uma
agência que gerencie meus anúncios com foco em resultado"). A instrução
explícita ao modelo é **nunca mencionar o nome da empresa** — o que
queremos descobrir é se ela aparece sem ser citada por nome.

**Análise:** você clica "Analisar agora". Para cada uma das 15 perguntas:
1. Manda a pergunta ao Claude **com busca na web ativada** — é uma
   ferramenta do próprio modelo, ele pesquisa de verdade antes de
   responder, não responde de memória.
2. Pega a resposta e todos os links citados como fonte.
3. Aqui entra a parte que **não usa IA**, de propósito: uma função
   determinística verifica se o domínio ou o nome da marca aparecem nos
   links citados ou no texto, com fronteira de palavra (para "Acme" não
   casar dentro de "Acme Industries") e ignorando sufixo societário.
4. Grava: citou ou não, em que posição, e quais concorrentes apareceram
   no lugar do cliente.

**Por que a decisão final não é "pergunte para a IA se ela te citou":** um
falso positivo aqui faz o cliente confiar numa métrica errada — é o tipo
de erro mais caro de se ter num produto que vende "prova de citação".

**De onde vem o dado:** as perguntas são geradas pela IA uma vez (ficam
salvas); cada rodada de análise é uma consulta nova, real, com busca na
web, gastando chamada de API a cada pergunta.

**Limitação real que vale saber:** existe no banco um campo para cadastrar
variações do nome da marca e domínios alternativos, mas **não existe tela
para preencher isso ainda**. Hoje o sistema sempre usa só o nome do blog e
o domínio próprio. Marca com apelido comum ou grafia alternativa pode
perder uma citação real por causa disso.

**O que falta para evoluir:**
- Tela para cadastrar nomes e domínios alternativos da marca.
- Cron semanal automático (hoje é só sob demanda — dá uma foto, não uma
  tendência ao longo do tempo).
- Segundo provedor (Perplexity) — mais barato e devolve fonte citada de
  forma mais explícita. O código já está desenhado para receber, falta o
  adaptador.

---

## 5. Google Meu Negócio — como vai funcionar de verdade

Hoje, sem a chave de API: nada roda, a tela mostra aviso claro.

Quando a chave estiver configurada: você digita "nome do negócio, cidade",
o sistema busca esse texto na **Places API do Google** (a mesma base que
alimenta o Google Maps) e traz de volta: nome, endereço, status (aberto ou
fechado), telefone, site, se tem horário cadastrado, nota, número de
avaliações, quantas fotos o Google indexou. 7 regras rodam em cima disso
(mesmo estilo da Auditoria — puro cálculo, sem IA) e devolvem uma nota.

**O que isso NÃO faz, e por quê:** não responde avaliação, não posta no
perfil, não vê descrição nem serviços cadastrados. Isso só existe na
**Business Profile API**, que exige o cliente autorizar via login do
Google **e** aprovação de acesso do Google ao nosso projeto — processo que
trava semanas e está fora do nosso controle. Por isso o v1 fica só na
parte que funciona sem essa fricção.

**De onde vem o dado:** 100% público, ao vivo, direto do Google — o
cliente não precisa conectar nada.

**Bloqueio atual:** falta cartão para ativar o faturamento do Google
Cloud (Pix não é aceito). Sem isso a API não liga.

**O que falta para evoluir:**
- Resolver o cartão (bloqueio de negócio, não de código).
- Fase 2: gestão completa via Business Profile API, condicionada à
  aprovação do Google.

---

## 6. Relatórios — por que parece solto

O motivo é simples: hoje ele só **conta**, não **conecta**.

Todo artigo publicado carrega um script invisível que, ao carregar a
página, avisa nossa própria rota de rastreio: blog, artigo, e um código
anônimo de visitante (guardado no navegador, sem cookie, sem Google
Analytics). O mesmo acontece quando alguém clica no botão de CTA ou
WhatsApp. A tela de Relatórios soma essas linhas: quantas visitas,
quantos cliques, em quais páginas.

**De onde vem o dado:** rastreio próprio, 100% real, gravado a cada
visita de verdade no blog publicado.

**O que falta para evoluir (é o item de maior retorno da lista toda):**
ligar isso ao resto — "este artigo, sobre esta keyword, trouxe X visitas e
Y conversas" em vez de números soltos por caminho de URL. O dado já
existe no banco; falta só a tela que conta essa história.

---

## O que é real e o que é fictício, hoje

Checado direto no banco de produção nesta data — **não existe dado
fictício, mock ou de demonstração em lugar nenhum do sistema**. Tudo que
aparece foi gerado por chamada de API de verdade, contra o único blog de
testes existente (`testando dataknow`, domínio `dataknow.es`):

| Módulo | O que existe hoje | Real ou estimado |
|---|---|---|
| Artigos | 2 (1 publicado, 1 rascunho) | Real — gerado pelo Claude |
| Keywords | 24 (10 sugeridas, 12 descartadas, 2 escritas) | Real — geradas pelo Claude; dificuldade/oportunidade são opinião da IA, não dado de mercado |
| Auditoria de site | 1 rodada — nota Google 55, nota IA 88, 6 páginas | Real — crawler ao vivo |
| Perguntas de Visibilidade IA | 15 | Real — geradas pelo Claude |
| Análises de Visibilidade IA | 15 checagens, 0 citações na rodada mais recente | Real — cada uma é uma busca na web de verdade |
| Google Meu Negócio | 0 auditorias | Nunca rodou — falta a chave |
| Analytics | 4 pageviews, 0 cliques de CTA | Real — visitas de verdade na página publicada |

O DNA da Marca cadastrado é da própria agência do usuário (real), embora
escrito em espanhol num blog marcado como português — vale revisar esse
texto com quem cuida do conteúdo, não é bug de código.

---

## O que fazer para melhorar — lista priorizada

1. **ROI por artigo** (Relatórios) — maior retorno por menor esforço, dado
   já existe, falta só a tela.
2. **Cadastro de nomes/domínios alternativos** (Visibilidade IA) — corrige
   um ponto cego real na detecção de citação.
3. **Trava de qualidade antes de publicar** (Conteúdo) — rede de segurança
   para quando a geração sair ruim.
4. **Resolver o cartão do Google Cloud** (Google Meu Negócio) — bloqueio
   de negócio, destrava o módulo já construído.
5. **Ativar DataForSEO** (Estratégia) — troca opinião da IA por volume de
   busca real.
6. **Cron semanal de Visibilidade IA** — de foto pontual para tendência.
7. **Ligar achado de auditoria a ação** — "sem `llms.txt`" vira botão,
   não só texto.
8. **Recuperação de senha e cobrança** — seguem como bloqueio comercial,
   fora do escopo técnico dos módulos acima.
