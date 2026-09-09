-- Conexão com Search Console e GA4.
--
-- Modelo escolhido: UMA conta Google por workspace (a da agência), não uma
-- por cliente. Cada cliente só adiciona esse e-mail como usuário no Search
-- Console e no GA4 dele (2 minutos, sem senha compartilhada) - evita OAuth
-- por cliente e a fila de revisão de app do Google, que já travou duas
-- vezes neste projeto (Business Profile, Ads API).
--
-- refresh_token é credencial de verdade: dá acesso de leitura aos dados
-- reais de todo cliente que compartilhou acesso com essa conta. Por isso
-- RLS sem nenhuma policy de select - só o client admin (chave de papel de serviço, que
-- ignora RLS) toca esta tabela, nunca o client do navegador.
create table google_integration (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  connected_email text not null,
  refresh_token text not null,
  connected_at timestamptz not null default now()
);

alter table google_integration enable row level security;
-- Nenhuma policy de select/insert/update para authenticated ou anon:
-- com RLS ligada e zero policy, toda linha fica invisível para esses
-- papéis. Só a chave de papel de serviço (que ignora RLS) lê e escreve aqui.

-- Qual propriedade do Search Console e qual propriedade do GA4 este blog
-- usa. Nullable: a conexão pode existir no workspace antes de qualquer
-- blog ser mapeado.
alter table blogs add column if not exists gsc_property text;
alter table blogs add column if not exists ga4_property_id text;
