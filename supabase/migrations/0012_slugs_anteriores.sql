-- Slugs que o blog já usou. Renomear o endereço (/b/<slug>) sem guardar o
-- antigo quebraria todo link publicado e indexado; o proxy procura aqui e
-- responde 301 para o endereço novo. GIN porque a busca é "contém".
alter table blogs add column if not exists slugs_anteriores text[] not null default '{}';
create index if not exists blogs_slugs_anteriores_idx on blogs using gin (slugs_anteriores);

-- Última camada da regra de segurança: o domínio raiz de um cliente nunca
-- pode virar endereço do blog. A tela e a rota de servidor já recusam, mas o
-- RLS ainda deixa um usuário logado gravar `custom_domain` direto pelo client
-- do Supabase. O banco recusa o que dá para medir sem lista de sufixos:
-- menos de três partes (cliente.es), www e .vercel.app. `cliente.com.br` (três
-- partes, mas raiz) continua barrado só pela aplicação.
-- `not valid`: não reprova linhas antigas, vale para toda gravação daqui em
-- diante.
alter table blogs drop constraint if exists blogs_custom_domain_seguro;
alter table blogs add constraint blogs_custom_domain_seguro check (
  custom_domain is null
  or (
    array_length(string_to_array(custom_domain, '.'), 1) >= 3
    and custom_domain !~* '^www\.'
    and custom_domain !~* '\.vercel\.app$'
  )
) not valid;
