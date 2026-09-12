# Avaliação crítica do Know SEO — setembro/2026

Levantamento feito com dado real do banco de produção e do código, não com
memória do que foi construído. Serve de base para priorizar.

## Números que sustentam esta avaliação

| Evidência | Valor |
|---|---|
| Workspaces / blogs | 2 / 2 (nenhum cliente pagante) |
| Artigos | 3 |
| Auditorias concluídas | 6 (2 sites) |
| Checagens de citação em IA | 25, num só motor (Claude) |
| Eventos de analytics | 5 |
| Código | ~16,5 mil linhas; 17 arquivos de teste, 228 testes |
| Rotas de API | 17 |
| Domínio próprio ativo | 0 (os dois blogs em `domain_status: pending`) |

## Nota por dimensão

| Dimensão | Nota | Razão |
|---|---|---|
| Motor de auditoria | 8,5 | determinístico, testado, discrimina de verdade, agora com entidade |
| Raio X - GEO (medição) | 8 | separa citação de busca, 3 motores previstos, honesto |
| Design e acabamento | 8 | sistema de componentes, contraste medido, claro/escuro/celular |
| Geração de conteúdo | 6 | estruturada, mas sem trava de qualidade e sem prova de resultado |
| Mercado / Estratégia | 5 | o dado medido depende de credencial travada; resto é leitura de modelo |
| Relatórios | 4 | conta visita, não conecta a resultado |
| Pronto para vender | 3 | sem senha, sem cobrança, sem multi-cliente, sem limite de custo |

## O que está bom

1. **Honestidade do dado.** O produto distingue medição de opinião em todo
   lugar ("Leitura da IA:", "artigos publicados, não volume de busca"). Isso
   é raro e é o que sobrevive ao cliente conferir em outra ferramenta.
2. **Auditoria com poder de discriminação.** Penalidade proporcional,
   `fetchComStatus`, regras de entidade. Duas notas de sites parecidos se
   moveram em direções opostas — prova de que a nota significa algo.
3. **Raio X - GEO mede o que ninguém pequeno mede.** Citação real, com a
   separação entre "citou" e "só apareceu na busca", e o laço que
   transforma pergunta perdida em pauta.
4. **Acabamento.** Sistema de controles, régua, jornada, esqueleto de
   carregamento, sessão validada localmente. O painel parece instrumento.

## O que está ruim, por gravidade

### 1. O conteúdo não ajuda o site que o cliente quer ranquear
O blog nasce em `cliente.knowseo` ou, com domínio próprio, em
`blog.cliente.com` — **host separado do site institucional**. Autoridade
não transfere entre hosts como transfere dentro do mesmo domínio. O produto
vende "conteúdo que melhora seu posicionamento" e entrega conteúdo que
ranqueia **outro** endereço. Nenhum cliente tem domínio próprio ativo hoje
(`domain_status: pending` nos dois), então na prática o conteúdo mora fora.
**Correção estrutural:** servir o blog em `cliente.com/blog` via proxy
reverso (rewrite no provedor do cliente), ou assumir o blog como ativo
próprio e parar de prometer efeito no site institucional.

### 2. Bloqueadores comerciais absolutos
- **Sem recuperação de senha.** Nenhuma rota. Cliente trancado para fora
  em semanas.
- **Sem cobrança.** `plan` e `credits` no schema, zero checkout.
- **Sem multi-cliente.** `blogs[0]` em 11 arquivos: o painel é
  monocliente na prática, e o comprador é agência.

### 3. Economia unitária invertida
Crédito só é debitado ao **gerar artigo** — a operação barata. A rodada do
Raio X - GEO (até 30 buscas na web e 10 chamadas de modelo grande) e a
auditoria não debitam nada. Com clientes reais, o uso mais caro é grátis.

### 4. O dado medido depende de credencial travada
Search Console sem propriedade e Google Ads bloqueado. Sem eles, Mercado e
Estratégia voltam a ser leitura de modelo — exatamente o que o produto
critica. O Raio X - GEO roda com um motor só (Claude), então "a IA" é uma
IA.

### 5. Conteúdo sem rede de segurança
Não existe trava de qualidade antes de publicar. Artigo raso ou genérico
vai ao ar com a marca do cliente — o risco mais caro do produto.

### 6. Relatórios de vaidade
Visitas e cliques soltos, sem ligar artigo → keyword → visita → conversa.
O dado já está no banco.

### 7. Testes cobrem só o miolo
228 testes, todos de função pura. Nenhuma rota de API testada, nenhum fluxo
ponta a ponta. Os bugs caros deste projeto foram de integração.

## Ordem que eu seguiria

1. Decidir onde o conteúdo mora (proxy para `/blog` ou reposicionar a
   promessa). Decisão de produto, não de código.
2. Recuperação de senha + cobrança + multi-cliente: sem isso não há venda.
3. ~~Débito de crédito no Raio X - GEO e na auditoria.~~ **Adiado pelo
   dono (set/2026): limite e consumo dependem do plano que o cliente
   contratar, e isso é conversa de cobrança.** Fica registrado o risco que
   continua aberto: uma rodada do Raio X custa ~US$ 1,00 a 1,60 só com o
   Claude (busca a US$ 10/mil + o que a busca traz lido a US$ 5/MTok), não
   debita nada e ainda roda sozinha toda semana. Com três motores, de US$ 4
   a 20 por cliente por mês, sem teto.
4. Trava de qualidade antes de publicar.
5. ROI por artigo nos Relatórios.
6. Segundo motor de IA (Gemini, gratuito) para "a IA" deixar de ser uma só.
