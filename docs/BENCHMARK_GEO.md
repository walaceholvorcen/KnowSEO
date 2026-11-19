# Benchmark de monitoramento de GEO — 19/11/2026

Pesquisa feita antes de construir o painel de evolução de citações em IA.
Pergunta: o que as plataformas que já fazem isso medem, como medem, e o que
vale trazer para o Ranknow. Preços e números são os das páginas dos
fornecedores na data acima; os estudos citados são de fornecedores do
setor, então valem como ordem de grandeza.

## Quem foi olhado

| Plataforma | Para quem | Entrada | O que tem de próprio |
|---|---|---|---|
| Profound | empresa grande | sob consulta | volume de perguntas reais, robôs de IA no site, ChatGPT Shopping |
| Peec AI | marketing e agência | US$ 95/mês: 50 perguntas, 3 motores, diário | fontes por pergunta, ações recomendadas, plano de agência |
| Otterly.AI | pequeno | € 29/mês: 16 perguntas, diário | auditoria GEO de página, relatório de marca |
| Semrush AI Visibility | quem já usa Semrush | complemento | acompanhamento diário por pergunta, sentimento |
| Ahrefs Brand Radar | quem já usa Ahrefs | complemento | base enorme de perguntas modeladas, visão de marca |

## O padrão do mercado

Todas medem as mesmas cinco coisas:

1. **Visibilidade** — em que % das respostas a marca aparece.
2. **Share of voice** — a marca contra os concorrentes, nas mesmas perguntas.
3. **Posição** — em que ordem é mencionada.
4. **Sentimento** — como a IA fala da marca.
5. **Fontes** — quais sites e páginas a IA usou para responder.

E rodam **todo dia**, em 3 ou 4 motores, sobre dezenas a centenas de
perguntas. O plano mais barato da Peec gera 4.500 respostas por mês. O
Ranknow gera 40.

## Três achados que mudam o nosso plano

### 1. A resposta da API não é a que o usuário vê

Estudo da Surfer (1.000 perguntas, agosto/2026): no ChatGPT, a API citou
3,1 fontes por resposta e o aplicativo 12,1; os domínios em comum ficaram
entre 5% e 12%. No Perplexity a distância é menor (27% de domínios em
comum). A Profound diz na própria página que mede "a experiência do
consumidor, não a saída da API".

Consequência: nosso adaptador do ChatGPT usa a API. Ligar a chave como está
mediria uma coisa diferente do que o comprador vê.

### 2. Uma pergunta, uma vez, não mede nada

Estudo SparkToro/Gumshoe (2.961 execuções): a mesma pergunta devolve a
mesma lista de marcas em menos de 1% das vezes. Posição é ruído. O que se
mantém estável é a **% de aparições ao longo de muitas execuções**.

Consequência: "citou ou não citou esta semana" é sorteio. O número certo é
frequência, e ela exige repetição.

### 3. Quem lidera liga a medição ao que fazer

Lacuna de conteúdo (onde o concorrente é citado e você não), auditoria da
página para IA, robôs de IA visitando o site e visitas que chegam vindas
do ChatGPT. O Ranknow já tem as fontes do mercado, a auditoria e o botão
"Escrever a resposta" - e nenhuma delas escreve o artigo. Não temos:
visitas vindas de IA e robôs de IA no site.

## O que trazer para o Ranknow

| # | O quê | Por quê |
|---|---|---|
| 1 | Visibilidade em % e share of voice contra os 5 maiores rivais | é o padrão, e é o número que se mexe antes da "primeira citação" |
| 2 | Cada pergunta repetida várias vezes por semana | sem repetição o número é sorteio (achado 2) |
| 3 | Largar "posição" | ruído comprovado |
| 4 | Visitas vindas de IA, por artigo | é o resultado de verdade, e hoje não guardamos de onde o visitante veio - mudança pequena no rastreio |
| 5 | Fontes: presente ou ausente em cada uma | já temos a lista; falta marcar e acompanhar |
| 6 | Sentimento: não agora | a marca ainda não é mencionada; não há o que medir |

Os degraus propostos antes (o Google conhece → a IA encontra → a IA cita)
continuam valendo e nenhuma das cinco tem o primeiro ligado ao Search
Console.

## ChatGPT e Perplexity: como implementar

**ChatGPT** — não pela API da OpenAI. Usar um serviço que captura a tela
real do ChatGPT. O DataForSEO (LLM Scraper) cobra de US$ 0,0012 a 0,004 por
resposta, com fontes. Três subcontas × 25 perguntas × todo dia = 2.250
respostas por mês = **US$ 3 a 9 por mês**, com recarga mínima de US$ 50.
A conferir antes de contratar: se cobre Espanha e espanhol.

**Perplexity** — a API serve, a distância para o aplicativo é a menor. Mas
nosso adaptador aponta para o "Sonar", que saiu da página de preços oficial
(relatos falam em aposentadoria em 27/09/2026). Reescrever para a API atual
antes de comprar a chave. Busca a US$ 2,50 por mil chamadas, mais os tokens.

**Google (AI Overviews / AI Mode)** — o mesmo serviço de captura cobre o
Gemini; fica para a segunda leva.

## Fontes

- https://peec.ai/pricing
- https://otterly.ai/pricing
- https://www.tryprofound.com/features
- https://surfer.ai/blog/llm-scraped-ai-answers-vs-api-results
- https://searchengineland.com/ai-recommendation-lists-rarely-repeat-study-468076
- https://dataforseo.com/pricing/ai-optimization/llm-scraper
- https://docs.perplexity.ai/docs/getting-started/pricing.md
- https://explodingtopics.com/blog/ai-visibility-vs-brand-radar
