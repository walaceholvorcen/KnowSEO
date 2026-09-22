// O Supabase devolve erros de autenticação em inglês ("Invalid login
// credentials"). Quem está criando conta não tem que decifrar isso: os casos
// conhecidos viram frases em português que dizem o problema e a saída.
// Mensagem desconhecida passa direto - errado seria escondê-la.
export function traduzErroAuth(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme seu email antes de entrar — o link está na sua caixa de entrada.";
  }
  if (m.includes("already registered")) {
    return "Já existe uma conta com este email. Entre em vez de criar outra.";
  }
  // O mínimo e a regra de composição moram no Supabase (Authentication →
  // Email): 10 caracteres, com minúscula, maiúscula e número. Mudou lá,
  // muda aqui e no placeholder do cadastro e da nova senha.
  if (m.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 10 caracteres.";
  }
  if (m.includes("password should contain")) {
    return "A senha precisa ter letra minúscula, letra maiúscula e número.";
  }
  if (m.includes("weak") || m.includes("pwned") || m.includes("leaked")) {
    return "Esta senha já apareceu em vazamentos na internet. Escolha outra.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  // "<none>" é o que a biblioteca do Supabase põe quando o servidor de
  // contas não respondeu (erro 5xx do lado deles). Apareceu na tela de
  // login de verdade, e não dizia nada a quem estava tentando entrar.
  if (m.includes("<none>") || m.includes("timeout") || m.includes("unavailable")) {
    return "O servidor de contas não respondeu. Tente de novo em alguns segundos.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  }
  return mensagem;
}
