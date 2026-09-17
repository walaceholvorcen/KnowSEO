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
    -- Só a forma normalizada: "Cliente.es." ou " cliente.es" escapariam das
    -- comparações abaixo e da busca exata do proxy.
    custom_domain = lower(btrim(custom_domain, ' .'))
    and array_length(string_to_array(custom_domain, '.'), 1) >= 3
    and custom_domain !~* '^www\.'
    and custom_domain !~* '\.vercel\.app$'
  )
) not valid;

-- Essas colunas só mudam pelas rotas de servidor (/api/blog/configuracoes e
-- /api/blog/verificar-dominio), que conferem o dono do blog antes e gravam
-- com o client de serviço. Pelo client do navegador, o RLS deixaria o dono
-- marcar o próprio domínio como 'active', gravar um domínio raiz de sufixo
-- que o banco não mede (cliente.com.br) ou pôr slug alheio em
-- slugs_anteriores para roubar o 301. INSERT segue liberado (onboarding).
revoke update (domain_status, slugs_anteriores, custom_domain, subdomain) on blogs from authenticated;
-- O revoke por coluna acima NÃO basta sozinho: o Supabase concede UPDATE na
-- tabela inteira para authenticated, e no Postgres o privilégio de tabela
-- vence o revoke de coluna. Por isso tiramos o UPDATE da tabela e devolvemos
-- coluna a coluna todas as outras. Coluna criada depois desta migração nasce
-- sem UPDATE para o navegador - falha fechada; conceda na migração dela.
revoke update on blogs from authenticated;
-- Mesmo raciocínio no INSERT: sem isto, criar um blog pelo navegador já com
-- custom_domain raiz e domain_status 'active' contornaria tudo. O onboarding
-- só envia workspace_id, name, subdomain, language e theme.
revoke insert on blogs from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'blogs'
    and column_name not in ('domain_status', 'slugs_anteriores', 'custom_domain', 'subdomain');
  execute format('grant update (%s) on blogs to authenticated', cols);
  execute format('grant insert (%s, subdomain) on blogs to authenticated', cols);
end $$;
