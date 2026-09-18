// Idioma em que pautas, artigos e perguntas do Raio X saem.
//
// Antes era "português do Brasil" fixo no código, e o cliente real é uma
// agência espanhola (dataknow.es) com language = 'pt' por erro de cadastro.
// A regra é a mesma do volume de busca (PROCESSO, seção 19): o domínio
// decide, o idioma cadastrado é reserva. Quem tem .es vende na Espanha e
// escreve em espanhol, seja o que for que o cadastro diga.
import { paisDoBlog } from "./keywords/metricas.ts";

export type CodigoIdioma = "es" | "pt" | "en";

export interface IdiomaDoBlog {
  codigo: CodigoIdioma;
  /** Frase pronta para o prompt. Nomeia a variante porque o código sozinho
   *  fez o modelo escrever "precisas conquistar" para público brasileiro. */
  instrucao: string;
  /** Para a tela: "as pautas saem em espanhol da Espanha". */
  rotulo: string;
}

function def(codigo: CodigoIdioma, rotulo: string, instrucao?: string) {
  return { codigo, rotulo, instrucao: instrucao ?? `Escreva em ${rotulo}` };
}

// Chaves iguais às de PAIS em metricas.ts: é o país que define a variante.
const POR_PAIS: Record<string, IdiomaDoBlog> = {
  es: def("es", "espanhol da Espanha"),
  mx: def("es", "espanhol do México"),
  co: def("es", "espanhol da Colômbia"),
  ar: def("es", "espanhol da Argentina"),
  cl: def("es", "espanhol do Chile"),
  br: def(
    "pt",
    "português do Brasil",
    "Escreva em português do Brasil (nunca português de Portugal)",
  ),
  pt_pt: def("pt", "português de Portugal"),
};

/**
 * Código de idioma para o navegador e para o Google (<html lang>) e para
 * formatar datas no blog público. A variante vem do mesmo idiomaDoBlog que
 * decide a língua dos artigos, então data e texto nunca discordam.
 */
export function localeDoBlog(blog: { custom_domain: string | null; language: string }): string {
  const idioma = idiomaDoBlog(blog);
  if (idioma.codigo === "en") return "en";
  if (idioma.codigo === "pt") return idioma === POR_PAIS.pt_pt ? "pt-PT" : "pt-BR";
  const pais = paisDoBlog({ dominio: blog.custom_domain, idioma: blog.language });
  return pais.origem === "dominio" && /^[a-z]{2}$/.test(pais.chave)
    ? `es-${pais.chave.toUpperCase()}`
    : "es-ES";
}

// Reserva, quando o domínio não diz o país (blog hospedado, .com).
const POR_IDIOMA: Record<string, IdiomaDoBlog> = {
  es: POR_PAIS.es,
  pt: POR_PAIS.br,
  en: def("en", "inglês"),
};

export function idiomaDoBlog(blog: {
  custom_domain: string | null;
  language: string;
}): IdiomaDoBlog {
  const pais = paisDoBlog({ dominio: blog.custom_domain, idioma: blog.language });
  if (pais.origem === "dominio") return POR_PAIS[pais.chave];
  return POR_IDIOMA[blog.language] ?? POR_PAIS[pais.chave];
}

// O DNA da marca tem regra de estilo em texto livre, e o caso real era
// "Escreva em português do Brasil" num blog espanhol. O idioma do blog
// vence; isto só detecta a contradição para avisar (tela) e para o prompt
// dizer de forma explícita que ignora a regra.
// ponytail: busca por palavra, não entende contexto - "público português"
// num blog espanhol também dispara. É só um aviso; refinar se incomodar.
const OUTRO_IDIOMA: Record<CodigoIdioma, RegExp> = {
  es: /portugu[eêé]s|ingl[eêé]s|english/i,
  pt: /espa[nñ]h?ol|castellano|ingl[eêé]s|english/i,
  en: /portugu[eêé]s|espa[nñ]h?ol|castellano/i,
};

export function dnaContradizIdioma(
  regrasDeEstilo: string | null | undefined,
  codigo: CodigoIdioma,
): boolean {
  return Boolean(regrasDeEstilo && OUTRO_IDIOMA[codigo].test(regrasDeEstilo));
}

// Detecta o idioma de um texto já gravado (pauta, título, corpo de artigo).
//
// Existe por causa do acervo: antes de `idiomaDoBlog`, 24 pautas e alguns
// artigos da agência espanhola saíram em português, e a tela de Estratégia
// prometia "espanhol da Espanha" listando essas mesmas pautas. Sem migração,
// a leitura marca o que está fora - e diz quando não sabe (null), em vez de
// chutar.
//
// Palavras-função e marcadores que só existem numa das línguas. "para",
// "de", "que", "está", "como" ficam de fora de propósito: são iguais em
// português e espanhol e só empatariam a contagem. "no", "nos" e "o" também:
// em espanhol são "não", "nos" e "ou", e inflariam o português.
// ponytail: contagem de marcadores, não modelo de idioma. Texto curto sem
// nenhum marcador volta null; trocar por detector estatístico se o null
// virar regra em vez de exceção.
const PALAVRAS: Record<CodigoIdioma, Set<string>> = {
  pt: new Set(
    "não você vocês com em um uma uns umas do da das na nas mais e ao aos pelo pela seu sua seus suas quanto quanta custa investir reduzir sem quais tempo melhor guia conta estrutura brasil mês".split(" "),
  ),
  es: new Set(
    "cómo qué cuánto cuánta con en el la los las un una unos unas del al y tu tus su sus guía práctica cuenta estructura invertir reducir sin cuáles tiempo mejor más españa".split(" "),
  ),
  en: new Set(
    "the how what for your you and of to with is are in on this that".split(" "),
  ),
};

// Letras e sufixos exclusivos: "ç", "ã", "õ", "ê" não existem no espanhol;
// "ñ", "¿", "¡" e "-ción" não existem no português.
const MARCAS = {
  pt: /[çãõêô]|R\$|\bpara os?\b/gi,
  es: /ñ|[¿¡]|ci[oó]n(es)?\b|€/gi,
};

export function detectarIdioma(texto: string): CodigoIdioma | null {
  const pontos: Record<CodigoIdioma, number> = { pt: 0, es: 0, en: 0 };
  const palavras = texto.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  for (const p of palavras) {
    for (const cod of ["pt", "es", "en"] as const) {
      if (PALAVRAS[cod].has(p)) pontos[cod]++;
    }
  }
  for (const cod of ["pt", "es"] as const) {
    pontos[cod] += texto.match(MARCAS[cod])?.length ?? 0;
  }
  const [primeiro, segundo] = (Object.entries(pontos) as [CodigoIdioma, number][])
    .sort((a, b) => b[1] - a[1]);
  // Precisa vencer com folga (o dobro): um artigo espanhol que cita "Brasil"
  // uma vez não vira português, e um empate volta "não sei".
  if (primeiro[1] === 0 || primeiro[1] < segundo[1] * 2) return null;
  return primeiro[0];
}

// Trechos que falam de outro mercado ("no Brasil", preço em R$) num blog que
// não vende no Brasil. Devolve o trecho com um pouco de contexto para a tela
// mostrar o que está errado, não só dizer que há algo.
export function trechosForaDoMercado(texto: string, max = 3): string[] {
  const achados: string[] = [];
  for (const m of texto.matchAll(/\bno Brasil\b|R\$\s?[\d.,]*/gi)) {
    const ini = Math.max(0, m.index - 50);
    const fim = Math.min(texto.length, m.index + m[0].length + 50);
    achados.push(
      `${ini > 0 ? "…" : ""}${texto.slice(ini, fim).replace(/\s+/g, " ").trim()}${fim < texto.length ? "…" : ""}`,
    );
    if (achados.length >= max) break;
  }
  return achados;
}

// "Não sei" (null) não conta como fora: marcar sem certeza seria esconder a
// dúvida atrás de um aviso.
export function foraDoIdioma(texto: string, codigo: CodigoIdioma): boolean {
  const detectado = detectarIdioma(texto);
  return detectado !== null && detectado !== codigo;
}

export const NOME_IDIOMA: Record<CodigoIdioma, string> = {
  pt: "português",
  es: "espanhol",
  en: "inglês",
};
