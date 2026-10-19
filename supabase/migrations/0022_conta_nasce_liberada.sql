-- ----------------------------------------------------------------------------
-- CONTA NOVA NASCE LIBERADA
--
-- A 0016 fez o contrário, e estava certa para o mundo dela: não existia
-- nenhum teto de uso, então uma conta nova solta era uma conta gerando
-- artigo sem limite na conta da Anthropic do dono. A liberação manual era o
-- único freio que havia.
--
-- Agora existe outro, e melhor: a 0021 trouxe a cota. Conta sem plano tem 5
-- artigos no total - o que o ranknow.es/planes promete - e `barrarSemCota`
-- confere isso na rota que escreve. O freio deixou de ser uma pessoa
-- lembrando de clicar e virou um número.
--
-- O que decidiu a troca foi o uso real: a plataforma hoje é ferramenta de
-- trabalho, não produto de prateleira. A conta é montada aqui dentro e
-- entregue pronta a quem vai usar. A aprovação manual não protegia de
-- estranho nenhum - atrasava o próprio dono. No dia 18/10 um cliente ficou
-- um dia inteiro olhando para um aviso amarelo porque ninguém foi avisado
-- de que ele tinha entrado.
--
-- A coluna FICA, e o aviso na tela também: `liberado = false` continua
-- valendo para pausar uma conta específica à mão. Deixou de ser o estado
-- inicial de todo mundo; virou exceção, que é o que sempre deveria ter sido.
-- ----------------------------------------------------------------------------

alter table workspaces
  alter column liberado set default true;

-- Nenhum grant novo: desde a 0016 o navegador só escreve `name` e
-- `onboarding_steps`. Ninguém se libera sozinho pelo cadastro - quem libera
-- continua sendo o default da coluna ou o service role.

comment on column workspaces.liberado is
  'true = pode usar as operações que gastam IA. Nasce true desde a 0022; false é pausa manual de uma conta específica. Só o dono muda (service role).';
