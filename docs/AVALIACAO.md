# Avaliação crítica do Know SEO — 24/setembro/2026

Levantamento feito com dado real do banco de produção e do código, não com
memória do que foi construído. Serve de base para priorizar.

A avaliação anterior é de começo de setembro. O que mudou desde então está
marcado, porque o que já foi corrigido vale tanto quanto o que falta.

## Números que sustentam esta avaliação

| Evidência | Hoje | Em setembro |
|---|---|---|
| Workspaces / blogs | 2 / 2 (nenhum cliente pagante) | 2 / 2 |
| Blog em domínio próprio ativo | **1** (`blog.dataknow.es`) | 0 |
| Artigos | 7 (4 publicados, 3 em rascunho) | 3 |
| Auditorias concluídas | 15, com 56 achados | 6 |
| Checagens de citação em IA | 75 — **todas no Claude** | 25 |
| Citações encontradas | **0 de 75** | 0 |
| Pautas com keyword | 62 | — |
| Links internos mapeados | 16 | — |
| Eventos de analytics | 17 | 5 |
| Código | ~29 mil linhas; 35 arquivos de teste, 382 testes | ~16,5 mil; 17 arquivos, 228 testes |
| Rotas de API | 28 | 17 |

## Nota por dimensão

| Dimensão | Hoje | Antes | Razão |
|---|---|---|---|
| Motor de auditoria | 8,5 | 8,5 | determinístico, testado, discrimina de verdade — mas ainda não mede velocidade nem link quebrado |
| Raio X - GEO (medição) | 7,5 | 8 | o código ganhou 4 motores; a realidade continua sendo um só. A nota caiu porque agora a distância entre o prometido e o rodado é medível |
| Design e acabamento | 8,7 | 8 | bancada única nas oito telas, contraste medido, tela de erro, autosave, login como face de instrumento |
| Geração de conteúdo | 7,5 | 6 | trava de qualidade antes de publicar, formato que a IA cita, autor e datas. Falta prova de resultado |
| SEO entregue ao cliente | 7,5 | — | estrutura completa e rápida; sem volume de busca e sem Search Console |
| Mercado / Estratégia | 5 | 5 | o dado medido depende de credencial travada. Escondido do painel, que é a atitude honesta |
| Relatórios | 7 | 4 | leitura escrita do período, corrente dos cinco elos, visitas e conversas por artigo |
| Segurança | 8 | — | RLS, permissão por coluna, sem Supabase no navegador, HTML sanitizado, teto de uso. Falta CSP bloqueando e 2FA nas contas |
| Pronto para vender | 5 | 3 | senha, multi-cliente e domínio automático resolvidos. Sem cobrança e sem landing page não há negócio |

## O que está bom

1. **Honestidade do dado.** O produto distingue medição de opinião em todo
   lugar ("Leitura da IA:", "artigos publicados, não volume de busca", "2 de
   9 visitas" em vez de "22,2%"). É raro, e é o que sobrevive ao cliente
   conferir em outra ferramenta.
2. **Auditoria com poder de discriminação.** Penalidade proporcional,
   regras de entidade, histórico. Notas de sites parecidos já se moveram em
   direções opostas — prova de que a nota significa algo.
3. **O blog saiu do limbo.** Em setembro o conteúdo morava num host
   separado do site do cliente, o que não transfere autoridade. Hoje existe
   subdomínio no ar, modo pasta construído, e o domínio é liberado
   automaticamente pela plataforma — sem mandar instrução de DNS para o
   cliente.
4. **Velocidade medida, não suposta.** Artigo em ~0,3s e arquivos de
   rastreamento em ~0,2s, com número de antes e depois registrado.
5. **Acabamento.** O painel parece instrumento de medição, não revista. Foi
   decisão consciente, rejeitada duas vezes antes de acertar.

## O que está ruim, por gravidade

### 1. Não existe como cobrar
`plan` e `credits` estão no banco desde o começo e continuam sem checkout.
Tudo o mais que está nesta lista é melhoria; isto é a diferença entre
produto e negócio. **É o próximo item, sem discussão.**

### 2. O produto que vende SEO não tem SEO
A raiz do site redireciona para o login. Nenhuma página nossa é indexável,
e a descrição nos metadados ainda está em espanhol, de uma versão antiga.
Somado ao rebrand para Ranknow, que ainda não começou, é a vitrine inteira
por fazer.

### 3. "A IA" continua sendo uma IA
Quatro motores no código, 75 checagens no Claude e nenhuma em outro. O
Gemini está instalado e devolve 429 por cota. Enquanto isso não virar, a
tela diz "as IAs" e mede uma.

### 4. O dado medido ainda depende de credencial travada
Search Console sem propriedade verificada e Google Ads sem acesso Básico.
Sem eles, a escolha de pauta é leitura de modelo — exatamente o que o
produto critica no concorrente — e não conseguimos provar posição ao
cliente, só contar as visitas que nós mesmos registramos.

### 5. Custo por cliente sem teto de plano
O teto por hora entrou e resolve o abuso. O que continua aberto é o custo
recorrente: uma rodada do Raio X custa de US$ 1,00 a 1,60 só com o Claude,
não debita crédito e roda sozinha toda semana. Com quatro motores, de US$ 4
a 20 por cliente por mês. **Adiado pelo dono (set/2026): limite e consumo
dependem do plano contratado, e isso é conversa de cobrança** — ou seja,
resolve junto com o item 1.

### 6. Testes cobrem o miolo, não as bordas
382 testes, quase todos de função pura. Nenhuma rota de API testada, nenhum
fluxo ponta a ponta. Os bugs caros deste projeto foram todos de integração:
o blog do cliente redirecionando para o painel, o Gemini falhando calado, o
CNAME dito inexistente. Nenhum deles seria pego pelos testes que existem.

### 7. O acervo não se mantém
Nada revisita artigo antigo para atualizar dado ou reforçar link interno, e
não existe agendamento nem piloto automático. SEO é frequência, e a
frequência hoje depende de alguém clicar.

## Ordem que eu seguiria

1. **Cobrança.** Sem isso, nada do resto vira dinheiro.
2. **Landing page com a marca Ranknow.** A vitrine e a prova de que
   sabemos fazer o que vendemos.
3. **Search Console.** Transforma "12 visitas" em posição e impressão —
   é o que o cliente quer ver no relatório.
4. **Um segundo motor de IA rodando de verdade.** Resolver a cota do
   Gemini ou trocar de modelo.
5. **Teste das rotas de API.** Onde moram os bugs que já custaram caro.
6. **Agendamento e atualização de artigo antigo.**
