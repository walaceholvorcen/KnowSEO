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
  if (m.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  }
  return mensagem;
}
