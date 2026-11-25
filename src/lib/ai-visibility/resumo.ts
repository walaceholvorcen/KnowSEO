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
const ORDEM = ["chatgpt", "gemini", "perplexity", "claude"];

export const ROTULO_MOTOR: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
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

// A resposta parece ter sido interrompida pelo assistente (limite de tokens)?
//
// Não há coluna para o `stop_reason` - e as respostas antigas nem o têm -,
// então a tela deduz pelo texto: termina numa letra ou número, sem pontuação
// final. Sem este aviso a resposta cortada aparecia em silêncio, e o cliente
// lia a frase pela metade como se fosse tudo o que a IA disse.
// ponytail: heurística - item de lista final sem ponto também casa; trocar
// por coluna `truncada` quando valer uma migração.
export function pareceCortada(texto: string | null | undefined): boolean {
  // Marcas de markdown no fim (**negrito**, `código`) não são o fim da frase.
  const limpo = (texto ?? "").trimEnd().replace(/[*_`~]+$/, "");
  if (!limpo) return false;
  return /[\p{L}\p{N}]$/u.test(limpo);
}

// Visibilidade com margem de erro (intervalo de Wilson, 95%).
//
// Com dez perguntas, "20%" pode ser sorte: a IA responde diferente a cada
// vez, e numa amostra pequena dois acertos a mais mudam o número em vinte
// pontos. O intervalo diz até onde o número pode ir só por acaso - é o que
// impede o painel de comemorar (ou lamentar) um movimento que não existe.
// Wilson e não a fórmula simples porque ela não fica negativa nem passa de
// 100% com amostra pequena ou taxa perto de zero, que é o caso comum aqui.
export interface Visibilidade {
  /** Percentual medido, arredondado. */
  pct: number;
  /** Limites do intervalo de 95%, em pontos percentuais inteiros. */
  de: number;
  ate: number;
  /** Respostas consideradas: o tamanho da amostra, sempre mostrado. */
  n: number;
}

export function visibilidade(citadas: number, n: number): Visibilidade | null {
  if (n <= 0) return null;
  const z = 1.96;
  const p = citadas / n;
  const base = 1 + (z * z) / n;
  const centro = (p + (z * z) / (2 * n)) / base;
  const folga = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / base;
  return {
    pct: Math.round(p * 100),
    de: Math.max(0, Math.round((centro - folga) * 100)),
    ate: Math.min(100, Math.round((centro + folga) * 100)),
    n,
  };
}

/** Os intervalos se tocam: a diferença entre as duas medições pode ser acaso. */
export function dentroDaMargem(a: Visibilidade, b: Visibilidade): boolean {
  return a.de <= b.ate && b.de <= a.ate;
}

// Quais pares pergunta × motor merecem a terceira resposta.
//
// A mesma pergunta é feita duas vezes a cada motor. Onde as duas concordam
// (citou nas duas, ou em nenhuma), uma terceira quase nunca muda a leitura;
// onde discordam, é a terceira que desempata. Perguntar três vezes tudo
// custaria 50% a mais para confirmar o que já está estável.
export function paresParaDesempate(checks: CheckMin[]): { query_id: string; provider: string }[] {
  const pares = new Map<string, { query_id: string; provider: string; vistos: Set<boolean> }>();
  for (const c of checks) {
    const chave = `${c.query_id}\u0000${c.provider}`;
    const atual = pares.get(chave) ?? { query_id: c.query_id, provider: c.provider, vistos: new Set<boolean>() };
    atual.vistos.add(c.cited);
    pares.set(chave, atual);
  }
  return [...pares.values()]
    .filter((p) => p.vistos.size > 1)
    .map(({ query_id, provider }) => ({ query_id, provider }));
}
