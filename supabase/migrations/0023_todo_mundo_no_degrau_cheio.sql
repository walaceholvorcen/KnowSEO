-- ----------------------------------------------------------------------------
-- TODA CONTA NASCE NO DEGRAU CHEIO (90 ARTIGOS/MÊS)
--
-- Continuação da 0022, e pela mesma razão: a plataforma hoje é ferramenta de
-- trabalho, não produto de prateleira. Quem entra foi cadastrado pelo dono
-- para usar de verdade, não para experimentar — e a prova de 5 artigos, que
-- existe para quem chega sozinho pelo site, só atrapalhava quem já estava
-- dentro.
--
-- A cota NÃO foi desligada, e isso importa: `barrarSemCota` continua
-- conferindo a cada clique, 90 continua sendo um teto, e o número volta a
-- ser 4, 12 ou 30 no dia em que a cobrança entrar. O que mudou foi o valor
-- inicial, não a existência do freio.
--
-- O preço disto está dito em PROCESSO 76: o cadastro é público, então uma
-- conta criada por um desconhecido também nasce com 90. O conserto certo
-- não é diminuir o número — é fechar o cadastro e criar conta por convite.
-- ----------------------------------------------------------------------------

-- As que já existem. O `where` não é decoração: `update` sem filtro é
-- indistinguível de um acidente, tanto para quem lê quanto para as travas
-- que vigiam escrita em produção. Com filtro, a linha diz o que faz (põe no
-- degrau quem ainda não está) e pode rodar de novo sem tocar em nada.
update workspaces
   set plan = 'pro', artigos_por_mes = 90
 where plan is distinct from 'pro'
    or artigos_por_mes is distinct from 90;

-- As que vierem.
alter table workspaces alter column plan set default 'pro';
alter table workspaces alter column artigos_por_mes set default 90;

comment on column workspaces.artigos_por_mes is
  'Artigos por mês do plano. Nasce 90 desde a 0023, enquanto a plataforma é ferramenta de trabalho. Com a cobrança ligada, volta a ser o degrau contratado (4, 12, 30, 90).';
