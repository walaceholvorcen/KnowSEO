import { obterAccessToken } from "./oauth";

// Propriedades que a conta conectada enxerga - alimenta o seletor onde o
// usuário escolhe qual delas é este blog. Sem isto ele teria que digitar
// a URL exata da propriedade de cabeça, e errar um caractere quebra tudo
// silenciosamente (a API devolve lista vazia, não erro).
export async function listarPropriedades(
  workspaceId: string,
): Promise<string[]> {
  const token = await obterAccessToken(workspaceId);
  const res = await fetch(
    "https://www.googleapis.com/webmasters/v3/sites",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    siteEntry?: { siteUrl: string }[];
  };
  return (data.siteEntry ?? []).map((s) => s.siteUrl);
}

export interface LinhaDesempenho {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

// Cliques e impressões reais por termo de busca, para uma propriedade e
// período. É o dado que falta hoje: a Estratégia estima dificuldade com
// opinião da IA porque não tínhamos nenhum número real do Google.
export async function buscarDesempenhoDeBusca(params: {
  workspaceId: string;
  siteUrl: string;
  desde: string; // AAAA-MM-DD
  ate: string;
  limite?: number;
}): Promise<LinhaDesempenho[]> {
  const { workspaceId, siteUrl, desde, ate, limite = 25 } = params;
  const token = await obterAccessToken(workspaceId);

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: desde,
        endDate: ate,
        dimensions: ["query"],
        rowLimit: limite,
      }),
    },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    rows?: { keys: string[]; clicks: number; impressions: number; position: number }[];
  };

  return (data.rows ?? []).map((r) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: r.position,
  }));
}

export type StatusIndexacao = "indexado" | "nao_indexado" | "desconhecido";

// Diz se uma URL específica está indexada de verdade - é a peça que falta
// para a régua de fases do painel Início deixar de contar tempo e passar a
// medir. Uma chamada por artigo, então usar com moderação (não rodar em
// loop para a lista inteira a cada carregamento de tela).
export async function inspecionarUrl(params: {
  workspaceId: string;
  siteUrl: string;
  paginaUrl: string;
}): Promise<StatusIndexacao> {
  const { workspaceId, siteUrl, paginaUrl } = params;
  const token = await obterAccessToken(workspaceId);

  const res = await fetch(
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inspectionUrl: paginaUrl, siteUrl }),
    },
  );
  if (!res.ok) return "desconhecido";

  const data = (await res.json()) as {
    inspectionResult?: { indexStatusResult?: { verdict?: string } };
  };
  const veredito = data.inspectionResult?.indexStatusResult?.verdict;
  if (veredito === "PASS") return "indexado";
  if (veredito === "FAIL" || veredito === "NEUTRAL") return "nao_indexado";
  return "desconhecido";
}
