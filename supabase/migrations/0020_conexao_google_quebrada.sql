-- Quando a conexão com o Google morreu, e por isso parou de alimentar
-- Search Console, GA4 e o Planejador de Palavras-chave.
--
-- Até aqui a morte era silenciosa: o Mercado engolia o erro e o relatório
-- saía sem o dado do Google. Ninguém era avisado, e a agência descobriria
-- (ou não) ao mostrar um relatório vazio ao cliente.
--
-- Acontece mais do que parece. O caso mais comum não é falha nossa: app em
-- modo de teste no Google Cloud tem o acesso derrubado a cada 7 dias pelo
-- próprio Google. Também morre quando alguém revoga o acesso em
-- myaccount.google.com/permissions ou troca a senha da conta.
--
-- Guarda a data da PRIMEIRA falha, não da última: o que a tela precisa
-- dizer é há quanto tempo o dado parou de chegar.
alter table google_integration
  add column if not exists quebrada_em timestamptz;

comment on column google_integration.quebrada_em is
  'Quando o Google recusou o refresh_token (invalid_grant) pela primeira vez. Null = conexão viva. Limpa ao reconectar ou na primeira renovação que voltar a funcionar.';

-- Sem grant nem policy: a tabela tem RLS ligada e zero policy desde a
-- 0007, então só a chave de papel de serviço lê e escreve aqui.
