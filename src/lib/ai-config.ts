// Estado da credencial de IA, em um lugar só.
//
// Sem esta checagem as rotas estouravam dentro do SDK e devolviam 500 com
// corpo vazio - o usuário via a tela travar sem nenhuma explicação.

export function isAiConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && key.startsWith("sk-ant-"));
}

export const AI_NOT_CONFIGURED_MESSAGE =
  "Geração por IA desativada: falta configurar a chave da API no ambiente.";

/**
 * O que dizer quando a chamada à IA falha.
 *
 * Existe por um caso real: em 07/10 a conta da Anthropic ficou sem saldo, a
 * Estratégia parou de gerar pauta e a tela respondeu "Tente de novo em
 * instantes". Tentar de novo nunca ia resolver - só quem paga a conta
 * resolve -, e a mensagem mandava o operador insistir num botão morto.
 *
 * Três causas têm conserto conhecido e merecem nome próprio. O resto
 * continua com a frase genérica, que para falha passageira é a certa.
 */
export function mensagemDeFalhaDaIA(err: unknown, generica: string): string {
  const texto = String(
    (err as { message?: string } | null)?.message ?? err ?? "",
  ).toLowerCase();

  if (texto.includes("credit balance")) {
    return "A conta da Anthropic está sem saldo. Nenhuma geração funciona até comprar créditos em console.anthropic.com (Plans & Billing).";
  }
  if (texto.includes("rate limit") || texto.includes("429")) {
    return "A IA recusou por excesso de pedidos no minuto. Espere um pouco e tente de novo.";
  }
  if (texto.includes("authentication") || texto.includes("invalid x-api-key")) {
    return "A chave da Anthropic foi recusada. Confira se ela ainda é válida no console.";
  }
  return generica;
}
