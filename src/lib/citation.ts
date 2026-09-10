// Detector de citação: decide se a marca do cliente apareceu na resposta
// de uma IA. É a peça mais sensível do produto - um falso positivo faz o
// cliente perder a confiança e cancelar - então é lógica determinística e
// testável, sem IA envolvida na decisão.

export type MatchType = "domain" | "brand" | "none";

export interface CitationResult {
  cited: boolean;
  matchType: MatchType;
  position: number | null; // 1 = primeira fonte citada
  competitors: string[]; // empresas citadas que não são a marca
  /** Domínios citados que são diretório, agregador ou plataforma. Ficam
   *  separados dos concorrentes porque perder para o sortlist.com não é a
   *  mesma notícia que perder para uma agência rival - e listar os dois
   *  juntos transformava a tela num ranking de agregadores. */
  directories: string[];
  /** A marca apareceu no resultado da busca e mesmo assim não foi citada.
   *  É o diagnóstico mais acionável do módulo: a IA te encontrou e escolheu
   *  outro, então o problema é o conteúdo da página, não a descoberta. */
  foundInSearch: boolean;
}

export interface DetectInput {
  answerText: string;
  citationUrls: string[];
  /** Resultados brutos da busca. Nunca provam citação - ver AiAnswer. */
  searchResultUrls?: string[];
  brandNames: string[];
  brandDomains: string[];
}

// Domínios que aparecem em resposta de IA sem serem concorrentes do
// cliente: diretórios, marketplaces de serviço, redes sociais, enciclopédias
// e publishers de marketing. Sem esta separação, "quem a IA cita no seu
// lugar" virava uma lista de sortlist.com e semrush.com - e o painel Início
// chegava a escrever "a IA cita semrush.com em vez de você".
//
// Casa por domínio registrável e por sufixo, então "agencies.semrush.com"
// entra por causa de "semrush.com".
const DIRETORIOS = new Set([
  "sortlist.com", "clutch.co", "goodfirms.co", "designrush.com",
  "agencyspotter.com", "trustpilot.com", "yelp.com", "paginasamarillas.es",
  "doctoralia.es", "doctoralia.com.br", "tripadvisor.com", "g2.com",
  "capterra.com", "crunchbase.com", "glassdoor.com", "indeed.com",
  "producthunt.com", "semrush.com", "ahrefs.com", "moz.com", "hubspot.com",
  "similarweb.com", "wikipedia.org", "reddit.com", "quora.com",
  "youtube.com", "linkedin.com", "facebook.com", "instagram.com",
  "twitter.com", "x.com", "tiktok.com", "pinterest.com", "medium.com",
  "github.com", "amazon.com", "amazon.es", "google.com", "blogspot.com",
  "wordpress.com", "wix.com", "substack.com",
]);

export function isDirectory(domain: string): boolean {
  if (DIRETORIOS.has(domain)) return true;
  for (const conhecido of DIRETORIOS) {
    if (domain.endsWith(`.${conhecido}`)) return true;
  }
  return false;
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
  const {
    answerText,
    citationUrls,
    searchResultUrls = [],
    brandNames,
    brandDomains,
  } = input;

  const ownDomains = brandDomains
    .map(extractDomain)
    .filter((d): d is string => Boolean(d));

  const ehDaMarca = (dominio: string) =>
    ownDomains.some((own) => domainsMatch(dominio, own));

  // Só as fontes citadas entram aqui. Resultado de busca não prova nada.
  const citedDomains = citationUrls
    .map(extractDomain)
    .filter((d): d is string => Boolean(d));

  const outros = [...new Set(citedDomains.filter((d) => !ehDaMarca(d)))];
  const competitors = outros.filter((d) => !isDirectory(d));
  const directories = outros.filter((d) => isDirectory(d));

  const foundInSearch = searchResultUrls
    .map(extractDomain)
    .filter((d): d is string => Boolean(d))
    .some(ehDaMarca);

  const base = { competitors, directories, foundInSearch };

  // 1) Citação por domínio - sinal mais forte. A posição agora é a ordem
  //    entre as fontes que o modelo realmente usou, e não o índice num
  //    array que misturava citação com página de resultado.
  for (let i = 0; i < citedDomains.length; i++) {
    if (ehDaMarca(citedDomains[i])) {
      return { cited: true, matchType: "domain", position: i + 1, ...base };
    }
  }

  // 2) Menção no texto, mesmo sem link. Vale tanto o nome quanto o domínio
  //    escrito por extenso ("visite clinicamadrid.es") - antes só o nome era
  //    procurado, e uma menção com o endereço escrito passava batido.
  const normalizedAnswer = normalizeText(answerText);
  const mentioned =
    brandNames.some((name) => brandAppearsInText(normalizedAnswer, name)) ||
    ownDomains.some((dominio) =>
      normalizedAnswer.includes(dominio.toLowerCase()),
    );

  if (mentioned) {
    return { cited: true, matchType: "brand", position: null, ...base };
  }

  return { cited: false, matchType: "none", position: null, ...base };
}
