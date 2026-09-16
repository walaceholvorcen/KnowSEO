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
