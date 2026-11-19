-- ----------------------------------------------------------------------------
-- TRÁFEGO DE IA: OS ROBÔS DOS ASSISTENTES NO BLOG DO CLIENTE
--
-- O Raio X pergunta ao Claude e confere se a marca foi citada: é amostra.
-- Faltava a medição direta - o Claude (e o ChatGPT, e o Perplexity) abrindo
-- um artigo para responder alguém. Nenhum dos três oferece painel ao dono
-- do site, mas o blog é servido por nós: basta anotar a visita do robô.
--
-- Entra na mesma tabela das visitas, com um tipo novo, em vez de tabela
-- própria: é o mesmo fato ("alguém pediu esta página"), com as mesmas
-- chaves e a mesma regra de acesso. Os contadores existentes filtram por
-- tipo, então a linha nova não infla visita nem clique (conferido em
-- relatorio.ts, dashboard/dados.ts, reports/visao.tsx e contents/page.tsx).
--
-- `agente` guarda o nome que o robô declara ("claude-user"). O papel de
-- cada um - leitura a pedido, indexação, treino - mora em
-- src/lib/ia-trafego.ts, não aqui: a lista muda com frequência e trocar
-- código é mais barato que migrar dado.
-- ----------------------------------------------------------------------------

alter table analytics_events
  drop constraint if exists analytics_events_event_type_check;

alter table analytics_events
  add constraint analytics_events_event_type_check
  check (event_type in ('pageview', 'cta_click', 'whatsapp_click', 'ai_bot'));

alter table analytics_events
  add column if not exists agente text;

comment on column analytics_events.agente is
  'Robô de IA que pediu a página (claude-user, chatgpt-user...). Só em event_type = ai_bot.';

-- A tela do Raio X lê o período por blog e por tipo.
create index if not exists idx_analytics_blog_tipo_tempo
  on analytics_events (blog_id, event_type, created_at desc);
