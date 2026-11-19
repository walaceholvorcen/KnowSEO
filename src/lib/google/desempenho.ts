// O desempenho no Google, dia a dia, a partir do que o Search Console
// devolve. Função pura: a tela desenha o que sai daqui.
import { diasEntre } from "../grafico.ts";

export type Periodo = 7 | 28 | 90;

export const PERIODOS: { dias: Periodo; rotulo: string }[] = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 28, rotulo: "28 dias" },
  { dias: 90, rotulo: "3 meses" },
];

/** O período pedido no endereço; qualquer coisa fora da lista vira 28 dias. */
export function lerPeriodo(valor: string | undefined): Periodo {
  const n = Number(valor);
  return n === 7 || n === 90 ? n : 28;
}

export interface LinhaDoGoogle {
  /** O dia, a consulta ou a página - depende da dimensão pedida. */
  chave: string;
  cliques: number;
  impressoes: number;
  /** Fração de 0 a 1, como o Google manda. */
  ctr: number;
  posicao: number;
}

export interface Desempenho {
  dias: string[];
  cliques: number[];
  impressoes: number[];
  /** Em porcentagem. */
  ctr: number[];
  /** Null no dia sem impressão: sem aparecer, não existe posição. */
  posicao: (number | null)[];
  total: { cliques: number; impressoes: number; ctr: number; posicao: number | null };
  /** Último dia que o Google já fechou. Null = sem dado no período. */
  ate: string | null;
}

/**
 * Monta a série do período.
 *
 * O Google omite o dia sem impressão e ainda não tem os dois ou três mais
 * recentes. São ausências diferentes: a primeira é zero de verdade e entra
 * como zero; a segunda é "ainda não sei", e o eixo simplesmente termina no
 * último dia fechado - desenhar zero ali faria toda semana parecer queda.
 */
export function montarDesempenho(linhas: LinhaDoGoogle[], de: string): Desempenho {
  const porDia = new Map(linhas.map((l) => [l.chave, l]));
  const ate = linhas.length ? linhas.map((l) => l.chave).sort().at(-1)! : null;
  const dias = ate ? diasEntre(de, ate) : [];

  const cliques = dias.map((d) => porDia.get(d)?.cliques ?? 0);
  const impressoes = dias.map((d) => porDia.get(d)?.impressoes ?? 0);
  const totalCliques = cliques.reduce((s, v) => s + v, 0);
  const totalImpressoes = impressoes.reduce((s, v) => s + v, 0);

  // Posição média pesada pela impressão, como o Search Console faz: um dia
  // com uma impressão na posição 80 não pode pesar igual a um dia com
  // quinhentas na posição 6.
  const somaPosicao = dias.reduce((s, d) => {
    const l = porDia.get(d);
    return s + (l ? l.posicao * l.impressoes : 0);
  }, 0);

  return {
    dias,
    cliques,
    impressoes,
    ctr: dias.map((_, i) => (impressoes[i] ? (cliques[i] / impressoes[i]) * 100 : 0)),
    posicao: dias.map((d) => {
      const l = porDia.get(d);
      return l && l.impressoes > 0 ? l.posicao : null;
    }),
    total: {
      cliques: totalCliques,
      impressoes: totalImpressoes,
      ctr: totalImpressoes ? (totalCliques / totalImpressoes) * 100 : 0,
      posicao: totalImpressoes ? somaPosicao / totalImpressoes : null,
    },
    ate,
  };
}

/** "3,4%" - uma casa, vírgula. */
export function porcento(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** "12,3" - posição média com uma casa. */
export function umaCasa(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
