-- Slides do carrossel de Instagram gerado a partir do artigo.
--
-- Fica na própria linha do artigo, não em tabela separada com histórico:
-- diferente da auditoria (que faz sentido comparar rodada a rodada), o
-- carrossel é derivado do conteúdo atual do artigo - gerar de novo
-- substitui, não acumula. A rota de imagem (/api/carousel/[id]/[slide])
-- precisa ler daqui em vez de chamar a IA a cada visualização: sem isso a
-- imagem seria lenta, cara e diferente a cada carregamento.
alter table articles add column if not exists carousel_slides jsonb;
