// O que mudou entre duas auditorias do mesmo site.
//
// É esta função que transforma a auditoria de coisa que se roda três vezes
// em coisa que se acompanha. SEO não muda na hora: o cliente corrige hoje e
// o efeito aparece em semanas. Sem comparação, cada auditoria nova é uma
// lista parecida com a anterior e a pergunta "adiantou alguma coisa?" fica
// sem resposta - e é por isso que ele para de voltar. Com ela, a tela diz
// "você resolveu 2, apareceu 1 novo, 3 continuam".
//
// Casa por `code`, que é o identificador estável da regra. Título muda com
// o número de páginas ("3 títulos longos" vira "2 títulos longos"); o código
// não.

export interface AchadoResumo {
  code: string;
  title: string;
  severity: string;
  affected_count: number;
}

export interface Persistente {
  atual: AchadoResumo;
  anterior: AchadoResumo;
  /** Atinge mais páginas do que antes. */
  piorou: boolean;
  /** Atinge menos páginas do que antes - correção em andamento. */
  melhorou: boolean;
}

export interface Comparacao {
  novos: AchadoResumo[];
  resolvidos: AchadoResumo[];
  persistem: Persistente[];
}

const ORDEM = ["critical", "high", "medium", "quick_win", "info"];
const porGravidade = (a: AchadoResumo, b: AchadoResumo) =>
  ORDEM.indexOf(a.severity) - ORDEM.indexOf(b.severity);

export function compararAuditorias(
  atual: AchadoResumo[],
  anterior: AchadoResumo[],
): Comparacao {
  const antes = new Map(anterior.map((f) => [f.code, f]));
  const agora = new Map(atual.map((f) => [f.code, f]));

  const novos = atual.filter((f) => !antes.has(f.code)).sort(porGravidade);
  const resolvidos = anterior
    .filter((f) => !agora.has(f.code))
    .sort(porGravidade);

  const persistem = atual
    .filter((f) => antes.has(f.code))
    .sort(porGravidade)
    .map((f) => {
      const velho = antes.get(f.code)!;
      return {
        atual: f,
        anterior: velho,
        piorou: f.affected_count > velho.affected_count,
        melhorou: f.affected_count < velho.affected_count,
      };
    });

  return { novos, resolvidos, persistem };
}

// Frase de uma linha para abrir a tela. Só fala do que mudou; se nada
// mudou, diz isso - "tudo igual" também é informação para quem está
// esperando o efeito de uma correção.
export function resumirComparacao(c: Comparacao): string {
  const partes: string[] = [];
  if (c.resolvidos.length) {
    partes.push(
      `${c.resolvidos.length} ${c.resolvidos.length === 1 ? "problema resolvido" : "problemas resolvidos"}`,
    );
  }
  if (c.novos.length) {
    partes.push(
      `${c.novos.length} ${c.novos.length === 1 ? "novo" : "novos"}`,
    );
  }
  const melhorando = c.persistem.filter((p) => p.melhorou).length;
  if (melhorando) {
    partes.push(`${melhorando} atingindo menos páginas`);
  }
  if (!partes.length) return "Nada mudou desde a auditoria anterior.";
  return `Desde a auditoria anterior: ${partes.join(", ")}.`;
}
