// Leitura de uma rodada do Raio X - GEO com mais de um motor.
//
// Com Claude, ChatGPT e Perplexity na mesma rodada, "citado em 3 de 30" não
// diz nada ao cliente: ele pensa em perguntas, não em pares pergunta ×
// motor. Então a rodada é lida em duas camadas - por pergunta (apareceu em
// pelo menos um assistente?) e por motor (em qual assistente você existe?).
// A divergência entre motores é justamente a informação que vale: cada um
// usa um índice de busca diferente, e ser citado no Perplexity e sumir no
// ChatGPT é um diagnóstico, não um erro de medição.

export interface CheckMin {
  query_id: string;
  provider: string;
  cited: boolean;
}

export interface PlacarMotor {
  provider: string;
  citadas: number;
  total: number;
}

// Ordem fixa de exibição: o motor que mais gente usa primeiro.
const ORDEM = ["chatgpt", "perplexity", "claude"];

export const ROTULO_MOTOR: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  claude: "Claude",
};

export function placarPorMotor(checks: CheckMin[]): PlacarMotor[] {
  const mapa = new Map<string, PlacarMotor>();
  for (const c of checks) {
    const atual = mapa.get(c.provider) ?? {
      provider: c.provider,
      citadas: 0,
      total: 0,
    };
    atual.total++;
    if (c.cited) atual.citadas++;
    mapa.set(c.provider, atual);
  }
  const pos = (p: string) => {
    const i = ORDEM.indexOf(p);
    return i === -1 ? ORDEM.length : i;
  };
  return [...mapa.values()].sort(
    (a, b) => pos(a.provider) - pos(b.provider) || a.provider.localeCompare(b.provider),
  );
}

// Perguntas em que a marca apareceu em pelo menos um assistente.
export function perguntasComCitacao(checks: CheckMin[]): Set<string> {
  return new Set(checks.filter((c) => c.cited).map((c) => c.query_id));
}

export function perguntasDaRodada(checks: CheckMin[]): Set<string> {
  return new Set(checks.map((c) => c.query_id));
}
