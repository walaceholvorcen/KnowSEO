// Detector de citação: decide se a marca do cliente apareceu na resposta
// de uma IA. É a peça mais sensível do produto - um falso positivo faz o
// cliente perder a confiança e cancelar - então é lógica determinística e
// testável, sem IA envolvida na decisão.

export type MatchType = "domain" | "brand" | "none";

export interface CitationResult {
  cited: boolean;
  matchType: MatchType;
  position: number | null; // 1 = primeira fonte citada
  competitors: string[]; // outros domínios citados
}

export interface DetectInput {
  answerText: string;
  citationUrls: string[];
  brandNames: string[];
  brandDomains: string[];
}

// Sufixos societários que não fazem parte do nome real da marca.
const LEGAL_SUFFIXES =
  /\b(s\.?l\.?u?|s\.?a\.?|sociedad limitada|ltda|ltd|llc|inc|gmbh|b\.?v\.?)\b/gi;

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBrand(value: string): string {
  return normalizeText(value)
    .replace(LEGAL_SUFFIXES, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Domínio registrável, sem www e sem subdomínio de terceiro nível comum.
export function extractDomain(rawUrl: string): string | null {
  try {
    const url = new URL(
      /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`,
    );
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function domainsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // trata subdomínio como o mesmo negócio (blog.marca.es ~ marca.es)
  return a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

// Marca aparece no texto como palavra inteira (evita casar "Dental" dentro
// de "Dentalia", ou a marca "Sol" dentro de "solución").
function brandAppearsInText(text: string, brand: string): boolean {
  const normalizedBrand = normalizeBrand(brand);
  if (normalizedBrand.length < 3) return false;

  const escaped = normalizedBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b não funciona bem com acentos já removidos + hífens; usamos
  // delimitadores explícitos de não-palavra.
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return pattern.test(text);
}

export function detectCitation(input: DetectInput): CitationResult {
  const { answerText, citationUrls, brandNames, brandDomains } = input;

  const ownDomains = brandDomains
    .map(extractDomain)
    .filter((d): d is string => Boolean(d));

  const citedDomains = citationUrls
    .map(extractDomain)
    .filter((d): d is string => Boolean(d));

  // 1) Citação por domínio - sinal mais forte
  let position: number | null = null;
  for (let i = 0; i < citedDomains.length; i++) {
    if (ownDomains.some((own) => domainsMatch(citedDomains[i], own))) {
      position = i + 1;
      break;
    }
  }

  const competitors = [
    ...new Set(
      citedDomains.filter(
        (d) => !ownDomains.some((own) => domainsMatch(d, own)),
      ),
    ),
  ];

  if (position !== null) {
    return { cited: true, matchType: "domain", position, competitors };
  }

  // 2) Menção da marca no texto, mesmo sem link
  const normalizedAnswer = normalizeText(answerText);
  const mentioned = brandNames.some((name) =>
    brandAppearsInText(normalizedAnswer, name),
  );

  if (mentioned) {
    return { cited: true, matchType: "brand", position: null, competitors };
  }

  return { cited: false, matchType: "none", position: null, competitors };
}
