-- ----------------------------------------------------------------------------
-- RADAR GEO — precisão da medição
--
-- Três colunas que faltavam para o módulo parar de afirmar o que não pode
-- provar.
--
-- 1. `directories`: domínio citado que é diretório, agregador ou rede social.
--    Antes ia tudo junto em `competitors`, e o painel Início chegava a
--    escrever "a IA cita semrush.com em vez de você" - frase absurda para o
--    cliente. Perder para o sortlist.com é uma notícia (a IA recomenda
--    diretório, não empresa); perder para uma agência rival é outra.
--
-- 2. `found_in_search`: a marca apareceu no resultado da busca e mesmo assim
--    não foi citada. É o diagnóstico mais acionável do módulo inteiro - a IA
--    encontrou o cliente e escolheu outro, então o problema está no conteúdo
--    da página, não em ser descoberto.
--
-- 3. `run_id`: identificador da rodada. Sem ele a "rodada" era reconstruída
--    na tela agrupando por DIA (checked_at::date). Duas análises no mesmo dia
--    viravam um ponto só com os totais somados - "15 perguntas" virava "30" -
--    e uma rodada que atravessasse a meia-noite se partia em duas. Era um bug
--    esperando dado real.
-- ----------------------------------------------------------------------------

alter table ai_visibility_checks
  add column if not exists directories text[] not null default '{}',
  add column if not exists found_in_search boolean not null default false,
  add column if not exists run_id uuid;

create index if not exists idx_checks_run on ai_visibility_checks(run_id);

comment on column ai_visibility_checks.competitors is
  'Domínios CITADOS na resposta que não são da marca, já sem diretórios. Nunca resultado bruto de busca.';

comment on column ai_visibility_checks.found_in_search is
  'A busca devolveu a marca ao modelo e ele não a citou.';
