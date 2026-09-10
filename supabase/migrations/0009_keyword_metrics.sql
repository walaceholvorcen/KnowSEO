-- ----------------------------------------------------------------------------
-- VOLUME DE BUSCA REAL (Planejador de Palavras-chave do Google Ads)
--
-- Duas mudanças pequenas na tabela de keywords:
--
-- 1. `source` passa a aceitar 'google_ads'. A origem de cada número viaja
--    junto com ele desde o início do produto, porque a tela precisa poder
--    dizer se aquele volume foi medido pelo Google ou estimado pelo modelo.
--
-- 2. `competition_index` nasce como coluna própria em vez de virar o campo
--    `difficulty`. O Google Ads mede concorrência de ANUNCIANTES - quantos
--    pagam por aquele termo -, que não é dificuldade de ranquear
--    organicamente. As duas coincidem em termo comercial e divergem em
--    termo informativo. Misturar as duas num campo só seria dado errado com
--    cara de dado certo, que é o pior tipo.
-- ----------------------------------------------------------------------------

alter table keywords drop constraint if exists keywords_source_check;

alter table keywords add constraint keywords_source_check
  check (source in ('ai', 'dataforseo', 'google_ads', 'manual'));

alter table keywords
  add column if not exists competition_index int
    check (competition_index between 0 and 100);

comment on column keywords.competition_index is
  'Concorrência de anunciantes no Google Ads (0-100). NÃO é dificuldade de SEO.';
