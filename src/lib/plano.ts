// A cota de artigos, lida do plano. Função pura: a trava na rota de geração
// e o contador na barra lateral respondem à mesma regra, e divergir seria
// pior que não ter contador - o cliente veria "faltam 3" e levaria recusa.
//
// O site (ranknow.es/planes) vende volume de publicação, não cliente nem
// blog: 4, 12, 30 ou 90 artigos por mês, com prova grátis de 5 artigos sem
// cartão. O que custa IA aqui é artigo, então é artigo que se conta.

/** Prova grátis: cinco artigos no TOTAL, não por mês. */
export const TESTE_ARTIGOS = 5;

export interface Cota {
  limite: number;
  /**
   * A coluna da migração 0021 ainda não existe neste banco. Não é "cota
   * zero", é "não dá para saber": nada é barrado e o contador some da tela.
   */
  indefinida?: true;
  /**
   * Desde quando contar. Null = desde sempre, que é o caso da prova: os
   * cinco artigos não voltam no dia 1.
   */
  desde: Date | null;
  /** Como a tela chama a janela: "este mês" ou "da prova". */
  janela: "mes" | "prova";
}

/**
 * Quanto esta conta pode gerar, e a partir de quando contar.
 *
 * `plan !== "pro"` cai na prova. É deliberado ser assim e não o contrário:
 * com o deploy antes da migração, ou com um valor inesperado na coluna, a
 * conta recebe o limite menor em vez de virar ilimitada. Errar para o lado
 * de cobrar a menos custa dinheiro; errar para o outro entrega o produto de
 * graça sem ninguém perceber.
 */
export function cotaDeArtigos(
  workspace: { plan?: string | null; artigos_por_mes?: number | null },
  agora: Date = new Date(),
): Cota {
  // Deploy na frente da migração: com `select *`, a coluna ausente chega
  // como `undefined` - diferente de `null`, que é a coluna existindo vazia
  // (prova grátis). A diferença importa muito: sem ela, toda conta cairia
  // na prova de 5 artigos no instante do deploy, e quem já tem 17 no banco
  // perderia o botão de escrever até alguém rodar o SQL. Mesma família de
  // tolerância do `liberado !== false` (seção 43).
  if (!("artigos_por_mes" in workspace)) {
    return { limite: Infinity, desde: null, janela: "mes", indefinida: true };
  }

  const pago = workspace.plan === "pro";
  const contratado = workspace.artigos_por_mes;

  if (!pago || !contratado || contratado < 1) {
    return { limite: TESTE_ARTIGOS, desde: null, janela: "prova" };
  }

  return {
    limite: contratado,
    desde: new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1),
    ),
    janela: "mes",
  };
}

/** "8 de 30 artigos este mês" / "3 de 5 artigos da prova". */
export function textoDaCota(usados: number, cota: Cota): string {
  const quando = cota.janela === "mes" ? "este mês" : "da prova";
  return `${usados} de ${cota.limite} ${cota.limite === 1 ? "artigo" : "artigos"} ${quando}`;
}

/** O que a tela diz quando acabou. Dois fins diferentes, duas saídas. */
export function mensagemDeCotaCheia(cota: Cota): string {
  return cota.janela === "mes"
    ? `Os ${cota.limite} artigos deste mês acabaram. A cota volta no dia 1; para escrever antes disso, troque de plano em ranknow.es/planes.`
    : `A prova grátis são ${cota.limite} artigos, e eles acabaram. Escolha um plano em ranknow.es/planes para continuar publicando.`;
}

/**
 * Blogs por conta. O site (ranknow.es/planes) vende "1 blog con tu marca",
 * e o painel deixava adicionar cliente sem limite nenhum - o produto
 * entregava mais do que a página cobrava.
 *
 * Constante e não coluna: enquanto houver um número só para todo mundo,
 * uma coluna seria configuração sem ninguém para configurar. No dia em que
 * existir plano de agência, isto vira `blogs_permitidos` em `workspaces`,
 * ao lado de `artigos_por_mes`.
 */
export const BLOGS_POR_CONTA = 1;

export function podeAdicionarBlog(quantos: number): boolean {
  return quantos < BLOGS_POR_CONTA;
}

export const MENSAGEM_LIMITE_DE_BLOGS =
  BLOGS_POR_CONTA === 1
    ? "Seu plano inclui um blog. Para atender outro cliente, ele precisa da própria conta - fale com a gente em ranknow.es/contacto."
    : `Seu plano inclui ${BLOGS_POR_CONTA} blogs. Fale com a gente em ranknow.es/contacto para ampliar.`;
