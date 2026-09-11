import { extractDomain, isDirectory } from "../citation.ts";

// As fontes que a IA usa para responder sobre o mercado do cliente.
//
// Resposta de assistente de IA não é inventada: é montada a partir de um
// punhado de sites, e quase nenhum deles é o site da empresa - são
// concorrentes, diretórios, portais e perfis onde a empresa é descrita por
// terceiros. É ali que a IA aprende a falar de alguém. Saber QUAIS são esses
// sites no mercado do cliente é o que transforma "a IA não cita você" em
// uma lista de lugares onde estar.
//
// Tudo contado sobre o que o Radar já grava em cada checagem (domínios
// citados na resposta, separados em empresa e diretório). Nenhuma chamada
// nova, nenhuma IA no cálculo.

export interface CheckFonte {
  query_id: string;
  provider: string;
  cited: boolean;
  competitors: string[] | null;
  directories: string[] | null;
}

export interface Fonte {
  dominio: string;
  /** Empresa do mesmo mercado, ou plataforma onde empresas são listadas. */
  tipo: "empresa" | "plataforma";
  /** Perguntas distintas em que o domínio foi citado, em qualquer motor. */
  perguntas: number;
  motores: string[];
}

export interface LeituraFontes {
  fontes: Fonte[];
  /** Domínios distintos citados na rodada, inclusive os fora da lista. */
  totalFontes: number;
  totalPerguntas: number;
  /** Perguntas em que a própria marca foi citada. */
  perguntasDaMarca: number;
  /** Quantas fontes citam em mais perguntas que a marca (a posição dela). */
  fontesAFrente: number;
  /** Fatia das citações que as maiores fontes levam; null com pouco dado. */
  concentracao: { fontes: number; pct: number } | null;
}

// Abaixo disso a porcentagem vira ruído: "3 sites levam 100%" com quatro
// citações no total não diz nada sobre o mercado.
const MIN_CITACOES_CONCENTRACAO = 12;
const FONTES_NA_CONCENTRACAO = 5;

export function lerFontes(checks: CheckFonte[], limite = 6): LeituraFontes {
  const porDominio = new Map<
    string,
    { tipo: Fonte["tipo"]; perguntas: Set<string>; motores: Set<string> }
  >();
  let citacoes = 0;

  for (const c of checks) {
    // O mesmo domínio duas vezes na mesma resposta é uma fonte, não duas.
    const daResposta = new Map<string, Fonte["tipo"]>();
    for (const bruto of c.competitors ?? []) {
      const d = extractDomain(bruto) ?? bruto;
      // Checagens antigas têm diretório misturado em `competitors` - a
      // separação de coluna é posterior. Classificado na leitura.
      daResposta.set(d, isDirectory(d) ? "plataforma" : "empresa");
    }
    for (const bruto of c.directories ?? []) {
      daResposta.set(extractDomain(bruto) ?? bruto, "plataforma");
    }

    for (const [dominio, tipo] of daResposta) {
      citacoes++;
      const atual = porDominio.get(dominio) ?? {
        tipo,
        perguntas: new Set<string>(),
        motores: new Set<string>(),
      };
      atual.perguntas.add(c.query_id);
      atual.motores.add(c.provider);
      porDominio.set(dominio, atual);
    }
  }

  const todas: Fonte[] = [...porDominio.entries()]
    .map(([dominio, v]) => ({
      dominio,
      tipo: v.tipo,
      perguntas: v.perguntas.size,
      motores: [...v.motores].sort(),
    }))
    // Mais perguntas primeiro; no empate, a fonte que mais motores usam -
    // é a que tem mais chance de aparecer no assistente que o cliente usa.
    .sort(
      (a, b) =>
        b.perguntas - a.perguntas ||
        b.motores.length - a.motores.length ||
        a.dominio.localeCompare(b.dominio),
    );

  const perguntasDaMarca = new Set(
    checks.filter((c) => c.cited).map((c) => c.query_id),
  ).size;

  let concentracao: LeituraFontes["concentracao"] = null;
  if (citacoes >= MIN_CITACOES_CONCENTRACAO) {
    // A contagem aqui é em citações (domínio × resposta), não em perguntas:
    // é a pergunta "de onde vêm as respostas", e uma fonte usada pelos três
    // motores na mesma pergunta pesa três vezes nela.
    const porCitacoes = new Map<string, number>();
    for (const c of checks) {
      const vistos = new Set<string>();
      for (const bruto of [...(c.competitors ?? []), ...(c.directories ?? [])]) {
        vistos.add(extractDomain(bruto) ?? bruto);
      }
      for (const d of vistos) porCitacoes.set(d, (porCitacoes.get(d) ?? 0) + 1);
    }
    const topo = [...porCitacoes.values()]
      .sort((a, b) => b - a)
      .slice(0, FONTES_NA_CONCENTRACAO);
    concentracao = {
      fontes: topo.length,
      pct: Math.round((topo.reduce((s, n) => s + n, 0) / citacoes) * 100),
    };
  }

  return {
    fontes: todas.slice(0, limite),
    totalFontes: todas.length,
    totalPerguntas: new Set(checks.map((c) => c.query_id)).size,
    perguntasDaMarca,
    fontesAFrente: todas.filter((f) => f.perguntas > perguntasDaMarca).length,
    concentracao,
  };
}
