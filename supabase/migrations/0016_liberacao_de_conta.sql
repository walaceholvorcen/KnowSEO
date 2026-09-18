-- ----------------------------------------------------------------------------
-- CONTA NOVA NASCE EM LIBERAÇÃO
--
-- O cadastro é aberto e a IA é paga pelo dono da plataforma. Sem esta trava,
-- qualquer pessoa criava uma conta e gerava artigos, pautas e rodadas do
-- Raio X na conta da Anthropic dele - e o teto por hora (limite-de-uso.ts)
-- vale por conta, então 50 contas eram 50 tetos.
--
-- Conta nova usa o que não custa IA (auditoria, mercado, configurações) e
-- espera o dono marcar `liberado`. As contas que já existem nascem
-- liberadas: são dele.
--
-- Quem libera é o dono, no Supabase (Table Editor → workspaces → liberado).
-- O usuário não pode se liberar sozinho: INSERT e UPDATE em workspaces
-- passam a valer só para as colunas que o app de fato grava. Sem isso,
-- bastaria mandar {liberado: true} no cadastro.
-- ----------------------------------------------------------------------------

alter table workspaces
  add column if not exists liberado boolean not null default false;

-- As que existem hoje são do dono da plataforma.
update workspaces set liberado = true where liberado = false;

comment on column workspaces.liberado is
  'true = pode usar as operações que gastam IA. Só o dono da plataforma muda (service role).';

-- O Supabase concede INSERT/UPDATE na tabela inteira a anon e authenticated,
-- e permissão de tabela vence revoke de coluna. Por isso tira-se da tabela
-- e devolve-se só o que o app usa: o cadastro grava id, name e slug; o
-- onboarding atualiza onboarding_steps.
revoke insert, update on workspaces from anon, authenticated;
grant insert (id, name, slug) on workspaces to authenticated;
grant update (name, onboarding_steps) on workspaces to authenticated;
