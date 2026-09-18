-- Dados e casos reais da empresa, usados pelo gerador de artigos.
-- brand_dna já é gerenciado pela policy "for all" dos membros do blog.
alter table brand_dna add column if not exists provas text;
comment on column brand_dna.provas is
  'Números, casos e resultados reais da empresa. O artigo usa como experiência própria; nunca inventa.';
