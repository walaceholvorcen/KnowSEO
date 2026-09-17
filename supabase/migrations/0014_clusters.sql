-- ----------------------------------------------------------------------------
-- PLANO DE CONTEÚDO (CLUSTER)
--
-- Até aqui cada pauta era solta: oito keywords sem relação entre si, uma por
-- linha. O que ranqueia, porém, não é artigo avulso - é cobertura de tema:
-- um artigo amplo (pilar) e vários específicos (apoio) ligados entre si.
--
-- Três colunas na própria tabela de keywords em vez de uma tabela nova: o
-- cluster não tem vida própria fora das pautas dele, e uma tabela separada
-- obrigaria join em toda leitura da Estratégia para exibir a mesma coisa.
-- `cluster_id` nulo é o que sempre existiu: pauta solta, que continua
-- valendo (uma pergunta perdida no Raio X não vira plano de seis artigos).
--
-- O id é gerado pela rota, não pelo banco: as pautas do plano entram num
-- insert só e precisam compartilhar o mesmo valor.
-- ----------------------------------------------------------------------------

alter table keywords
  add column if not exists cluster_id uuid,
  add column if not exists cluster_tema text,
  add column if not exists cluster_papel text;

alter table keywords drop constraint if exists keywords_cluster_papel_check;

alter table keywords add constraint keywords_cluster_papel_check
  check (cluster_papel is null or cluster_papel in ('pilar', 'apoio'));

create index if not exists keywords_cluster_idx
  on keywords (blog_id, cluster_id);

comment on column keywords.cluster_id is
  'Agrupa as pautas de um mesmo plano de conteúdo. Nulo = pauta solta.';
comment on column keywords.cluster_tema is
  'O assunto do plano, como foi pedido. Repetido em cada linha do cluster.';
comment on column keywords.cluster_papel is
  'pilar = o artigo amplo do tema; apoio = artigo específico que aponta para ele.';
