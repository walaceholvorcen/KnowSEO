import { obterAccessToken } from "./oauth";

// Propriedades GA4 que a conta conectada administra - mesmo papel que
// listarPropriedades tem no Search Console: alimenta o seletor, evita
// digitar o ID de cabeça.
export async function listarPropriedadesGa4(
  workspaceId: string,
): Promise<{ id: string; nome: string }[]> {
  const token = await obterAccessToken(workspaceId);
  const res = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    accountSummaries?: {
      propertySummaries?: { property: string; displayName: string }[];
    }[];
  };

  return (data.accountSummaries ?? []).flatMap((conta) =>
    (conta.propertySummaries ?? []).map((p) => ({
      // "property" vem como "properties/123456" - só o número é o que a
      // Data API espera de volta.
      id: p.property.replace("properties/", ""),
      nome: p.displayName,
    })),
  );
}

export interface SessoesPorCanal {
  canal: string;
  sessoes: number;
  conversoes: number;
}

// Sessão e conversão real por canal de origem (orgânico, direto, social,
// etc.) - complementa o analytics de primeira parte que já temos: o nosso
// mede visita e clique no próprio blog; o GA4 enxerga de onde a pessoa
// veio antes de chegar, o que não temos como medir sozinhos.
export async function buscarSessoesPorCanal(params: {
  workspaceId: string;
  propertyId: string;
  desde: string; // "28daysAgo" ou "AAAA-MM-DD"
  ate?: string;
}): Promise<SessoesPorCanal[]> {
  const { workspaceId, propertyId, desde, ate = "today" } = params;
  const token = await obterAccessToken(workspaceId);

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: desde, endDate: ate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "conversions" }],
      }),
    },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    rows?: {
      dimensionValues: { value: string }[];
      metricValues: { value: string }[];
    }[];
  };

  return (data.rows ?? []).map((r) => ({
    canal: r.dimensionValues[0]?.value ?? "(desconhecido)",
    sessoes: Number(r.metricValues[0]?.value ?? 0),
    conversoes: Number(r.metricValues[1]?.value ?? 0),
  }));
}
