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

// Motores do Raio X que não entram na rodada nem na tela, mesmo com chave
// configurada no ambiente.
//
// O Gemini está aqui porque a cota do Google devolve 429 desde o dia em que
// a chave foi instalada: ele aparecia como coluna no placar, consumia uma
// consulta por pergunta e devolvia erro em todas. Coluna que nunca tem
// número é pior que coluna que não existe - e o material de venda não pode
// prometer um motor que não mede.
//
// A chave continua no ambiente, intocada. Quando a cota for resolvida (ou o
// modelo trocado em GEMINI_GEO_MODEL), tirar o nome desta lista religa o
// motor na rodada e no placar - uma linha, sem mexer em segredo.
export const MOTORES_DESLIGADOS: readonly string[] = ["gemini"];
