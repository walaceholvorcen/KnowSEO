-- ----------------------------------------------------------------------------
-- QUEM ASSINA OS ARTIGOS
--
-- Artigo sem autor é o sinal de confiança que mais falta no blog hoje. O
-- Google (nas diretrizes de qualidade, o "E-E-A-T") e os assistentes de IA
-- pesam quem escreveu: nome, cargo e um perfil público que prove que a
-- pessoa existe. Sem isso, todo artigo do cliente se parece com o texto
-- genérico que qualquer um publica.
--
-- Um autor por blog, não por artigo: numa empresa pequena quem assina é o
-- dono ou o especialista, e é ele que o cliente final precisa ver. Formato
-- (validado em src/lib/autor.ts):
--   { "nome": "...", "cargo": "...", "bio": "...", "perfil": "https://..." }
--
-- UPDATE liberado só nesta coluna para o usuário logado: desde a 0012 o
-- navegador tem UPDATE por lista explícita de colunas em blogs, e coluna
-- nova fica de fora até ser nomeada aqui. A RLS de membro continua valendo.
-- ----------------------------------------------------------------------------

alter table blogs add column if not exists autor jsonb;

grant update (autor) on blogs to authenticated;

comment on column blogs.autor is
  'Quem assina os artigos: {nome, cargo, bio, perfil}. Aparece no artigo e no JSON-LD.';
