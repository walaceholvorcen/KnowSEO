// Onde a pauta deixa de ser palpite e passa a ter número do Google.
//
// A Estratégia sempre gerou keyword com "dificuldade" e "oportunidade"
// vindas do modelo - opinião, não medição. Com o Planejador de Palavras-
// chave conectado, o volume de busca passa a ser dado real do Google Ads.
//
// A DISTINÇÃO QUE NÃO PODE SER PERDIDA: o Google Ads devolve "competition",
// que é concorrência de ANUNCIANTES - quantos estão dando lance naquele
// termo. Isso NÃO é dificuldade de ranquear organicamente. As duas andam
// juntas em termos comerciais e se separam completamente em termos
// informativos (ninguém anuncia em "o que é canonical", e ranquear ali pode
// ser dificílimo). Por isso a concorrência entra num campo próprio, com
// rótulo próprio na tela, e o campo `difficulty` continua sendo o que
// sempre foi: leitura qualitativa do modelo.

export type Dificuldade = "baja" | "media" | "alta";

export interface MetricaReal {
  keyword: string;
  volumeMensal: number | null;
  /** 0-100, concorrência de anunciantes. Não é dificuldade de SEO. */
  indiceDeConcorrencia: number | null;
}

// Constantes de segmentação do Google Ads. São IDs fixos da API, não
// configuração - por isso moram no código e não em variável de ambiente.
const IDIOMA: Record<string, string> = {
  pt: "languageConstants/1014",
  es: "languageConstants/1003",
};

// `preposicao` existe porque a frase da tela é "1.900 buscas por mês <X>":
// na Espanha, no Brasil, em Portugal. Fica junto do rótulo em vez de virar
// um if na interface, que erraria em metade dos países.
const PAIS: Record<
  string,
  { constante: string; rotulo: string; preposicao: string }
> = {
  es: { constante: "geoTargetConstants/2724", rotulo: "Espanha", preposicao: "na" },
  br: { constante: "geoTargetConstants/2076", rotulo: "Brasil", preposicao: "no" },
  mx: { constante: "geoTargetConstants/2484", rotulo: "México", preposicao: "no" },
  co: { constante: "geoTargetConstants/2170", rotulo: "Colômbia", preposicao: "na" },
  ar: { constante: "geoTargetConstants/2032", rotulo: "Argentina", preposicao: "na" },
  cl: { constante: "geoTargetConstants/2152", rotulo: "Chile", preposicao: "no" },
  pt_pt: { constante: "geoTargetConstants/2620", rotulo: "Portugal", preposicao: "em" },
};

// Volume de busca só significa alguma coisa amarrado a um país: "agencia
// seo" tem número completamente diferente na Espanha e no Brasil. O produto
// ainda não pergunta ao cliente onde ele vende, então deduzimos - primeiro
// pelo domínio, que é o sinal mais confiável, e só depois pelo idioma.
//
// A dedução nunca fica escondida: a tela mostra o país usado junto do
// número, para que um palpite errado apareça na hora em vez de virar
// decisão de pauta em cima de dado do país errado.
const TLD_PARA_PAIS: Record<string, string> = {
  es: "es",
  br: "br",
  mx: "mx",
  co: "co",
  ar: "ar",
  cl: "cl",
  pt: "pt_pt",
};

export function paisDoBlog(params: {
  dominio: string | null;
  idioma: string;
}): { chave: string; constante: string; rotulo: string; preposicao: string } {
  const { dominio, idioma } = params;

  if (dominio) {
    const partes = dominio.toLowerCase().split(".");
    const ultimo = partes[partes.length - 1];
    const chave = TLD_PARA_PAIS[ultimo];
    if (chave && PAIS[chave]) return { chave, ...PAIS[chave] };
  }

  const padrao = idioma === "pt" ? "br" : "es";
  return { chave: padrao, ...PAIS[padrao] };
}

export function idiomaDoBlog(idioma: string): string {
  return IDIOMA[idioma] ?? IDIOMA.es;
}

// A API devolve inteiros de 64 bits como string no formato REST, e devolve
// o campo ausente quando não tem dado. Sem esta normalização, "0" viraria
// null e o número entraria na tela como texto.
export function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export interface ResultadoDaApi {
  text?: string;
  keywordIdeaMetrics?: {
    avgMonthlySearches?: string | number | null;
    competitionIndex?: string | number | null;
  } | null;
}

// Indexa por keyword em caixa baixa: o Google normaliza o termo devolvido
// ("Google Ads" volta "google ads") e sem isto nenhuma sugestão casaria.
export function indexarMetricas(
  resultados: ResultadoDaApi[],
): Map<string, MetricaReal> {
  const mapa = new Map<string, MetricaReal>();

  for (const item of resultados) {
    if (!item.text) continue;
    const chave = item.text.trim().toLowerCase();
    if (!chave || mapa.has(chave)) continue;

    mapa.set(chave, {
      keyword: item.text,
      volumeMensal: numeroOuNulo(item.keywordIdeaMetrics?.avgMonthlySearches),
      indiceDeConcorrencia: numeroOuNulo(
        item.keywordIdeaMetrics?.competitionIndex,
      ),
    });
  }

  return mapa;
}

export interface IdeiaEnriquecida {
  search_volume: number | null;
  competition_index: number | null;
  source: "ai" | "google_ads" | "dataforseo";
}

// Casa a ideia do modelo com a medição do Google. Sem medição, a linha
// continua existindo marcada como "ai" - a origem viaja junto com o dado
// porque a tela precisa poder dizer de onde veio cada número.
export function enriquecer(
  keyword: string,
  metricas: Map<string, MetricaReal>,
): IdeiaEnriquecida {
  const real = metricas.get(keyword.trim().toLowerCase());

  if (!real || real.volumeMensal === null) {
    return { search_volume: null, competition_index: null, source: "ai" };
  }

  return {
    search_volume: real.volumeMensal,
    competition_index: real.indiceDeConcorrencia,
    source: "google_ads",
  };
}
