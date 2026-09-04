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
