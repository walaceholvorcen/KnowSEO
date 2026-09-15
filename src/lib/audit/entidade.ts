// SEO de entidade: o site diz à máquina QUEM é a empresa?
//
// Google e assistentes de IA não citam texto, citam quem reconhecem - um
// nome ligado a uma categoria, a um lugar e aos perfis da empresa em outros
// sites. Duas coisas decidem esse reconhecimento e as duas dão para medir no
// HTML, sem IA nenhuma:
//
//   1. o bloco de dado estruturado da organização (JSON-LD), que é a ficha
//      de identidade que a máquina lê sem precisar interpretar prosa;
//   2. o texto em si: frase de folheto ("líder de mercado", "soluções
//      inovadoras") não tem nome, número nem relação - para a máquina é
//      texto sobre nada, e não há o que citar.
//
// Funções puras, como o resto da auditoria: recebem HTML ou texto e devolvem
// dado, para que as regras sejam testáveis sem rede.

export interface EntidadeSchema {
  tipo: string;
  nome: string | null;
  url: string | null;
  logo: boolean;
  descricao: boolean;
  /** Perfis da mesma empresa em outros sites (Instagram, LinkedIn...). */
  sameAs: string[];
  endereco: boolean;
  telefone: boolean;
  /** Tipo de negócio com endereço físico, onde endereço e telefone contam. */
  local: boolean;
  /** O nó como veio do site: a ficha para colar parte dele, não do zero. */
  bruto: Record<string, unknown>;
}

// Tipos do schema.org que descrevem a empresa, não uma página ou um artigo.
// LocalBusiness tem dezenas de subtipos (Dentist, LegalService, Store...);
// em vez de listar todos, os sufixos abaixo pegam a família inteira.
const TIPOS_ORGANIZACAO = new Set([
  "organization",
  "corporation",
  "localbusiness",
  "professionalservice",
  "onlinebusiness",
  "onlinestore",
  "ngo",
  "educationalorganization",
  "medicalorganization",
  "store",
  "restaurant",
  "dentist",
  "physician",
  "attorney",
  "legalservice",
  "realestateagent",
  "travelagency",
  "insuranceagency",
  "accountingservice",
  "financialservice",
  "homeandconstructionbusiness",
]);

const SUFIXOS_ORGANIZACAO = ["business", "organization", "service", "store"];

// Tipos que ancoram em um endereço físico. Organization pura (uma empresa
// 100% online) não tem por que ser cobrada de endereço.
function ehLocal(tipo: string): boolean {
  const t = tipo.toLowerCase();
  return t !== "organization" && t !== "corporation" && t !== "onlinebusiness" &&
    t !== "onlinestore" && t !== "ngo" && t !== "educationalorganization";
}

function ehOrganizacao(tipo: string): boolean {
  const t = tipo.toLowerCase();
  // "Service" puro descreve uma oferta, não quem oferece - o sufixo abaixo
  // o pegaria por engano.
  if (t === "service") return false;
  return (
    TIPOS_ORGANIZACAO.has(t) || SUFIXOS_ORGANIZACAO.some((s) => t.endsWith(s))
  );
}

function texto(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  return null;
}

function presente(v: unknown): boolean {
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return v !== null && typeof v === "object";
}

function listaDeUrls(v: unknown): string[] {
  const bruto = Array.isArray(v) ? v : [v];
  return bruto
    .map((x) => (typeof x === "string" ? x.trim() : null))
    .filter((x): x is string => !!x && /^https?:\/\//i.test(x));
}

/** Nós de organização encontrados nos blocos JSON-LD da página. */
export function extrairEntidades(html: string): EntidadeSchema[] {
  const achadas: EntidadeSchema[] = [];
  const blocos = html.matchAll(
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  const visitar = (no: unknown) => {
    if (Array.isArray(no)) return no.forEach(visitar);
    if (!no || typeof no !== "object") return;
    const obj = no as Record<string, unknown>;

    const tipos = (Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]])
      .filter((t): t is string => typeof t === "string");
    // Com vários tipos (["Organization", "ProfessionalService"]), vale o
    // mais específico: é ele que diz se a empresa tem endereço físico.
    const tipo =
      tipos.find((t) => ehOrganizacao(t) && ehLocal(t)) ??
      tipos.find(ehOrganizacao);

    if (tipo) {
      achadas.push({
        tipo,
        nome: texto(obj.name),
        url: texto(obj.url),
        logo: presente(obj.logo) || presente(obj.image),
        descricao: presente(obj.description),
        sameAs: listaDeUrls(obj.sameAs),
        endereco: presente(obj.address),
        telefone: presente(obj.telephone),
        local: ehLocal(tipo),
        bruto: obj,
      });
    }

    // A organização costuma vir aninhada: publisher de um Article,
    // provider de um Service, dentro de @graph.
    for (const chave of ["@graph", "publisher", "provider", "author", "brand", "parentOrganization"]) {
      if (obj[chave]) visitar(obj[chave]);
    }
  };

  for (const bloco of blocos) {
    try {
      visitar(JSON.parse(bloco[1].trim()));
    } catch {
      // JSON inválido já vira achado próprio (SCHEMA_INVALID).
    }
  }
  return achadas;
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

// Frases de folheto em português, espanhol e inglês (os mercados do
// produto). A lista é conservadora de propósito: só entra o que não
// carrega fato nenhum em qualquer contexto. "Experiência" sozinho pode ser
// fato ("20 anos de experiência"); "soluções inovadoras" nunca é.
const FRASES_VAZIAS = [
  // pt
  "lider de mercado",
  "lider no mercado",
  "lideres de mercado",
  "referencia no mercado",
  "referencia no setor",
  "solucoes inovadoras",
  "solucoes completas",
  "solucoes personalizadas",
  "solucoes sob medida",
  "atendimento de excelencia",
  "excelencia no atendimento",
  "atendimento diferenciado",
  "qualidade e compromisso",
  "compromisso com a qualidade",
  "equipe altamente qualificada",
  "profissionais altamente qualificados",
  "focados em resultados",
  "foco em resultados",
  "melhor custo-beneficio",
  "sua melhor escolha",
  "tradicao e qualidade",
  "inovacao e qualidade",
  "qualidade e agilidade",
  // es
  "lideres en el sector",
  "lider en el sector",
  "lider en el mercado",
  "lideres del mercado",
  "referente en el sector",
  "soluciones innovadoras",
  "soluciones integrales",
  "soluciones personalizadas",
  "soluciones a medida",
  "atencion personalizada",
  "calidad y compromiso",
  "compromiso con la calidad",
  "equipo altamente cualificado",
  "profesionales altamente cualificados",
  "orientados a resultados",
  "maxima calidad",
  "la mejor opcion",
  // en
  "industry leader",
  "market leader",
  "innovative solutions",
  "tailored solutions",
  "cutting-edge",
  "world-class",
  "best-in-class",
  "customer-centric",
  "one-stop shop",
];

/** Frases de folheto encontradas no texto, sem repetição, na forma da lista. */
export function frasesVazias(textoCorrido: string): string[] {
  const alvo = normalizar(textoCorrido);
  return FRASES_VAZIAS.filter((f) => alvo.includes(f));
}

// ------------------------------------------------------------ ficha pronta
// O achado de entidade dizia "adicione sameAs" e parava ali: o cliente não
// sabe o que é JSON-LD. A ficha abaixo é o bloco pronto para colar - parte do
// que o site já publica (nada do que existe se perde) e acrescenta o que dá
// para achar no próprio HTML. O que não dá (perfil de site feito em JS,
// endereço) o cliente completa na tela antes de copiar.

export const MARCA_FICHA = '<script type="application/ld+json">';

// Perfil de empresa, não post, vídeo, botão de compartilhar nem perfil de
// pessoa (/in/ do LinkedIn é o fundador, não a empresa).
const REDE =
  /^https?:\/\/(?:[a-z]+\.)?(instagram\.com|linkedin\.com|youtube\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com|pinterest\.[a-z.]+|github\.com)\/[^/?#]+/i;
const NAO_PERFIL =
  /share|intent|\/p\/|\/reels?\/|\/watch|\/embed|\/status\/|\/in\/|\/posts?\/|\/hashtag\/|\/explore\//i;

function maisRepetido(valores: string[]): string | null {
  const n = new Map<string, number>();
  for (const v of valores) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Um perfil por rede, o mais repetido entre as páginas: o rodapé se repete
 *  em todas, o link para o Instagram de um cliente num case não. */
export function perfisNoHtml(htmls: string[]): string[] {
  const porRede = new Map<string, string[]>();
  for (const html of htmls) {
    for (const [, href] of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      const url = href.trim().split(/[?#]/)[0].replace(/\/+$/, "");
      const m = url.match(REDE);
      if (!m || NAO_PERFIL.test(url)) continue;
      const rede = m[1].toLowerCase().replace("twitter.com", "x.com");
      porRede.set(rede, [...(porRede.get(rede) ?? []), url]);
    }
  }
  return [...porRede.values()]
    .map(maisRepetido)
    .filter((u): u is string => !!u);
}

interface PaginaParaFicha {
  url: string;
  html: string;
  metaDescription: string | null;
  entidades: EntidadeSchema[];
}

/** A ficha da organização com tudo o que o site já diz sobre ela. */
export function fichaDoSite(
  paginas: PaginaParaFicha[],
  origin: string,
  melhor?: EntidadeSchema,
): Record<string, unknown> {
  const home = paginas.find((p) => p.url.replace(/\/$/, "") === origin) ?? paginas[0];
  const base = melhor?.bruto ?? {};
  const htmls = paginas.map((p) => p.html);

  const siteName = home?.html.match(
    /<meta[^>]+property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']+)/i,
  )?.[1];

  const telefone = maisRepetido(
    htmls.flatMap((h) =>
      [...h.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map((m) =>
        decodeURIComponent(m[1]).trim(),
      ),
    ),
  );

  // Imagem que se declara logo no cabeçalho da home. og:image não serve: é
  // a capa de compartilhamento, quase nunca o logo.
  let logo: string | undefined;
  for (const [tag] of home?.html.matchAll(/<img\b[^>]*>/gi) ?? []) {
    const src = tag.match(/\ssrc\s*=\s*["']([^"']+)/i)?.[1];
    if (!/logo/i.test(tag) || !src || src.startsWith("data:")) continue;
    try {
      logo = new URL(src, home.url).href;
      break;
    } catch {}
  }

  const sameAs = [...new Set([...listaDeUrls(base.sameAs), ...perfisNoHtml(htmls)])];

  return {
    "@context": "https://schema.org",
    ...base,
    "@type": base["@type"] ?? "Organization",
    name: base.name ?? siteName,
    url: base.url ?? `${origin}/`,
    logo: base.logo ?? (base.image ? undefined : logo),
    description: base.description ?? home?.metaDescription ?? undefined,
    telephone: base.telephone ?? telefone ?? undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

export interface Complemento {
  nome?: string;
  perfis: string[];
  logo?: string;
  telefone?: string;
  rua?: string;
  cidade?: string;
  cep?: string;
  pais?: string;
}

const ehUrl = (s: string) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(s);

/** Junta à ficha o que o cliente preencheu na tela. Campo vazio não entra:
 *  bloco com "PREENCHA AQUI" colado em produção é pior que campo ausente. */
export function completarFicha(
  ficha: Record<string, unknown>,
  c: Complemento,
): Record<string, unknown> {
  const t = (s?: string) => s?.trim() || undefined;
  const perfis = c.perfis.map((p) => p.trim()).filter(ehUrl);
  const logo = t(c.logo);
  const endereco =
    t(c.rua) || t(c.cidade) || t(c.cep) || t(c.pais)
      ? {
          "@type": "PostalAddress",
          streetAddress: t(c.rua),
          addressLocality: t(c.cidade),
          postalCode: t(c.cep),
          addressCountry: t(c.pais)?.toUpperCase(),
        }
      : undefined;
  return {
    ...ficha,
    name: ficha.name ?? t(c.nome),
    logo: ficha.logo ?? (logo && ehUrl(logo) ? logo : undefined),
    telephone: ficha.telephone ?? t(c.telefone),
    address: ficha.address ?? endereco,
    sameAs: perfis.length ? [...new Set(perfis)] : undefined,
  };
}

/** O bloco como vai no <head>. `<` escapado: um "</script>" dentro de uma
 *  descrição fecharia a tag no meio do JSON. */
export function blocoJsonLd(ficha: Record<string, unknown>): string {
  return `${MARCA_FICHA}\n${JSON.stringify(ficha, null, 2).replace(/</g, "\\u003c")}\n</script>`;
}

/** Nome normalizado para comparar grafias da mesma marca entre páginas. */
export function nomeComparavel(nome: string): string {
  return normalizar(nome)
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}
