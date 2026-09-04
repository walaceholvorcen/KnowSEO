// Integração opcional com a DataForSEO para enriquecer as ideias de keyword
// (geradas pela IA) com volume de busca e dificuldade REAIS do Google Ads /
// Labs. Sem credenciais configuradas, o app funciona normalmente só com as
// estimativas qualitativas do Claude - isto aqui é um upgrade, não uma
// dependência dura do MVP.
//
// Credenciais: DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD (conta em
// https://dataforseo.com). Confirme o endpoint/shape exato na doc deles
// (https://docs.dataforseo.com) antes de ativar em produção - o formato
// abaixo segue a API v3 "Keywords Data > Google Ads > Search Volume" mas
// não foi testado contra credenciais reais ainda.

const LOCATION_CODES: Record<string, number> = {
  es: 2724, // España
  co: 2170, // Colombia
};

export interface RealKeywordMetrics {
  keyword: string;
  search_volume: number | null;
  competition_index: number | null; // 0-100
}

export function isDataForSeoConfigured() {
  return Boolean(
    process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD,
  );
}

export async function fetchRealKeywordMetrics(
  keywords: string[],
  countryCode: "es" | "co" = "es",
): Promise<Map<string, RealKeywordMetrics>> {
  const result = new Map<string, RealKeywordMetrics>();

  if (!isDataForSeoConfigured() || keywords.length === 0) {
    return result;
  }

  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`,
  ).toString("base64");

  try {
    const res = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            keywords,
            location_code: LOCATION_CODES[countryCode],
            language_code: countryCode === "co" ? "es" : "es",
          },
        ]),
      },
    );

    if (!res.ok) {
      console.error("[dataforseo] HTTP error", res.status, await res.text());
      return result;
    }

    const data = await res.json();
    const items = data?.tasks?.[0]?.result ?? [];

    for (const item of items) {
      if (!item?.keyword) continue;
      result.set(item.keyword.toLowerCase(), {
        keyword: item.keyword,
        search_volume: item.search_volume ?? null,
        competition_index: item.competition_index ?? null,
      });
    }
  } catch (err) {
    console.error("[dataforseo] request failed", err);
  }

  return result;
}
