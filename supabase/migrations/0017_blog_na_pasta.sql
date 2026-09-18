-- ----------------------------------------------------------------------------
-- BLOG NUMA PASTA DO SITE DO CLIENTE (cliente.com/blog)
--
-- Além do subdomínio (blog.cliente.com), o blog pode morar numa pasta do
-- site, encaminhada por um Worker do Cloudflare que o cliente instala
-- (src/lib/pasta.ts). É o formato que mais ajuda o SEO dele.
--
-- pasta_url    o endereço completo, "https://cliente.com/blog". O app
--              descobre o blog por ele: o Worker manda esse valor, e o
--              pedido só é atendido se ele bater com um blog cadastrado.
-- pasta_status o mesmo significado de domain_status: 'active' só depois
--              que a checagem encontra o blog respondendo na pasta. Até
--              lá, canonical e links continuam no endereço que funciona.
--
-- O formato é conferido também aqui, não só no app: sem pasta no caminho, o
-- blog ocuparia a página inicial do site do cliente - a regra de segurança
-- que vale desde o brief de 16/09.
--
-- As duas colunas ficam de fora do grant de UPDATE/INSERT que a 0012 deu
-- ao navegador (lista explícita de colunas): quem grava é só a rota de
-- servidor, depois de conferir o dono.
-- ----------------------------------------------------------------------------

alter table blogs
  add column if not exists pasta_url text,
  add column if not exists pasta_status text not null default 'pending';

alter table blogs drop constraint if exists blogs_pasta_status_check;
alter table blogs add constraint blogs_pasta_status_check
  check (pasta_status in ('pending', 'active', 'error'));

alter table blogs drop constraint if exists blogs_pasta_url_formato;
alter table blogs add constraint blogs_pasta_url_formato
  check (pasta_url is null or pasta_url ~ '^https://[a-z0-9.-]+(/[a-z0-9-]+){1,3}$');

-- Uma pasta, um blog: o endereço é o que identifica o blog no pedido.
create unique index if not exists blogs_pasta_url_unica
  on blogs (pasta_url) where pasta_url is not null;

comment on column blogs.pasta_url is
  'Blog numa pasta do site do cliente (https://cliente.com/blog), via Worker do Cloudflare.';
comment on column blogs.pasta_status is
  'active = checagem confirmou o blog respondendo na pasta. Só o servidor grava.';
