// Módulos prontos que ficam fora do painel.
//
// Mercado e Google Meu Negócio continuam existindo inteiros - rota, código,
// dado e teste. Só saem do que o cliente vê, para a tela apresentar o
// caminho curto (diagnóstico → pauta → conteúdo → resultado) sem duas
// paradas que ainda não entregam o mesmo tanto.
//
// Voltar é uma linha: trocar false por true devolve o item ao menu, ao
// painel Início e aos links das outras telas.
export const MODULOS_VISIVEIS = {
  mercado: false,
  gbp: false,
} as const;
