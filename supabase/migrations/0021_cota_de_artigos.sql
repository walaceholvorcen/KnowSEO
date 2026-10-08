-- A cota de artigos de cada conta, do jeito que o site vende.
--
-- ranknow.es/planes cobra por VOLUME DE PUBLICAÇÃO: 4, 12, 30 ou 90 artigos
-- por mês, com uma prova grátis de 5 artigos sem cartão. Não é por cliente
-- nem por blog - é artigo, que é exatamente o que custa IA do nosso lado.
--
-- `plan` já existia (parado desde que os créditos saíram do painel) e volta
-- a ter uso: 'pro' é quem paga, qualquer outro valor é prova.
--
-- `artigos_por_mes` guarda o degrau contratado. Fica nulo na prova, onde o
-- limite não é mensal: são 5 artigos no total, para sempre.
alter table workspaces
  add column if not exists artigos_por_mes int;

comment on column workspaces.artigos_por_mes is
  'Artigos por mês do plano contratado (4, 12, 30, 90 ou outro). Nulo na prova grátis, que tem 5 artigos no total, não por mês.';

-- As contas que já existem são do dono, com 17 artigos no banco. Deixá-las
-- cair na prova de 5 travaria a geração no primeiro clique. Mesma decisão
-- da 0016, que marcou `liberado` nas contas existentes.
update workspaces set plan = 'pro', artigos_por_mes = 90 where plan is distinct from 'pro';

-- Sem grant novo, de propósito: desde a 0016 o usuário só pode escrever
-- `name` e `onboarding_steps` em workspaces. Coluna nova nasce fora disso,
-- então ninguém muda o próprio plano pelo navegador - só rota de servidor,
-- e amanhã o webhook da cobrança.
