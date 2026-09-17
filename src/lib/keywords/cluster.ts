import type { Keyword } from "@/types";

// Agrupa as pautas por plano de conteúdo. Função pura: a Estratégia é a
// única tela que exibe isso hoje, mas a regra de "o que conta como escrito"
// é a mesma que o painel Início vai precisar.
//
// Duas decisões que valem regra:
//
// - Pauta descartada some do plano, mas o total do plano encolhe junto. O
//   denominador tem que ser o que ainda vale, senão "2 de 6" nunca chega a
//   "6 de 6" e o cliente acha que ficou pendente para sempre.
// - Plano sem pilar continua sendo plano. O modelo devolve o pilar sempre,
//   mas o cliente pode descartá-lo - e os apoios continuam sendo do mesmo
//   tema, ligados entre si.

export type PlanoAgrupado = {
  id: string;
  tema: string;
  /** Nulo quando o pilar foi descartado. */
  pilar: Keyword | null;
  apoios: Keyword[];
  /** Pautas do plano que ainda esperam escolha, na ordem de exibição. */
  abertas: Keyword[];
  escritos: number;
  total: number;
};

export function agruparEmPlanos(keywords: Keyword[]): {
  planos: PlanoAgrupado[];
  soltas: Keyword[];
} {
  const soltas: Keyword[] = [];
  const porId = new Map<string, Keyword[]>();

  for (const k of keywords) {
    if (k.status === "rejected") continue;
    if (!k.cluster_id) {
      if (k.status === "suggested") soltas.push(k);
      continue;
    }
    const lista = porId.get(k.cluster_id) ?? [];
    lista.push(k);
    porId.set(k.cluster_id, lista);
  }

  const planos: PlanoAgrupado[] = [];

  for (const [id, lista] of porId) {
    const pilar = lista.find((k) => k.cluster_papel === "pilar") ?? null;
    const apoios = lista.filter((k) => k.cluster_papel !== "pilar");
    const ordenadas = pilar ? [pilar, ...apoios] : apoios;

    planos.push({
      id,
      tema: lista.find((k) => k.cluster_tema)?.cluster_tema ?? "Plano de conteúdo",
      pilar,
      apoios,
      abertas: ordenadas.filter((k) => k.status === "suggested"),
      escritos: lista.filter((k) => k.status === "written").length,
      total: lista.length,
    });
  }

  // Plano com pauta aberta primeiro: é onde ainda há trabalho a fazer.
  // Entre dois iguais, o mais novo na frente.
  planos.sort(
    (a, b) =>
      Number(b.abertas.length > 0) - Number(a.abertas.length > 0) ||
      (a.tema < b.tema ? -1 : 1),
  );

  return { planos, soltas };
}
