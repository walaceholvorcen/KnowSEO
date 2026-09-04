-- A cor padrão do blog ainda era o violeta anterior ao rebrand: blog criado
-- fora do formulário nascia violeta, sem relação com marca nenhuma.
--
-- O padrão passa a ser tinta - neutro, funciona com qualquer logo e não
-- carimba a cor do Know SEO no blog do cliente.
alter table blogs
  alter column theme set default '{
    "primary_color": "#15191c",
    "logo_url": null,
    "tagline": null
  }'::jsonb;

update blogs
set theme = jsonb_set(theme, '{primary_color}', '"#15191c"')
where theme->>'primary_color' = '#7c3aed';
