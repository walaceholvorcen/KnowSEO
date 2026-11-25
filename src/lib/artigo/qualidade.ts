import { frasesVazias } from "../audit/entidade.ts";
import { normalizeText } from "../citation.ts";

// Trava de qualidade: as regras da auditoria aplicadas ao artigo ANTES de
// ele ir ao ar.
//
// Hoje a auditoria acusa "página com pouco conteúdo" depois que o estrago já
// está publicado no site do cliente. Isso é tarde: quem descobre é o cliente,
// e com a marca dele no ar. Aqui as mesmas regras rodam no texto recém
// escrito, onde corrigir ainda é barato.
//
// Dois níveis, de propósito:
//   trava - o que é indefensável publicar. Bloqueia o botão.
//   aviso - o que piora o resultado sem inviabilizar. Informa e libera.
//
// Função pura: serve na rota de geração (que tenta de novo antes de gastar o
// crédito) e no editor (que bloqueia a publicação), sem duplicar regra.

/** Mesmos limites da auditoria - ver src/lib/audit/rules.ts. */
const MIN_PALAVRAS = 300;
const TITULO_MIN = 30;
const TITULO_MAX = 60;
const META_MIN = 70;
const META_MAX = 155;
const PARAGRAFO_LONGO = 150;
const MIN_NUMEROS = 2;
/** Abaixo disto, em nomes próprios + números por 100 palavras, o texto é genérico. */
const MIN_DENSIDADE = 2;
/** Desvio-padrão do tamanho das frases abaixo do qual o ritmo é de máquina. */
const RITMO_MINIMO = 4;
const MIN_FRASES_RITMO = 15;

export type NivelDoAchado = "trava" | "aviso";

export interface AchadoDoArtigo {
  codigo: string;
  nivel: NivelDoAchado;
  titulo: string;
  comoCorrigir: string;
}

export interface ArtigoParaAvaliar {
  titulo: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  html: string;
  /** Pauta que originou o artigo. */
  keyword?: string | null;
  /** Páginas do site do cliente, para reconhecer link interno de verdade. */
  linksConhecidos?: string[];
  /** Pautas já publicadas neste blog, para acusar canibalização. */
  keywordsPublicadas?: string[];
}

export interface AvaliacaoDoArtigo {
  travas: AchadoDoArtigo[];
  avisos: AchadoDoArtigo[];
  palavras: number;
  podePublicar: boolean;
}

function semTags(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const contarPalavras = (texto: string) =>
  texto ? texto.split(/\s+/).filter(Boolean).length : 0;

function paragrafos(html: string): string[] {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
    semTags(m[1]),
  );
}

/** Blocos de texto com o HTML de dentro: é preciso ver se há link no bloco. */
function blocos(html: string): { html: string; texto: string }[] {
  return [...html.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({
    html: m[2],
    texto: semTags(m[2]),
  }));
}

// Estatística de pesquisa sem dono: "73% das empresas", "estudos mostram".
// É o dado que o leitor não confere e a IA não cita - e, quando inventado
// pelo modelo, o que derruba a credibilidade do cliente.
//
// Estreita de propósito. Calibrada em 33 artigos reais, a versão que pegava
// qualquer porcentagem acusava a regra 50/30/20, exemplos de conta ("reduz o
// CPA em 30%") e até dado com o Gartner nomeado. Só conta o que tem forma de
// pesquisa: porcentagem DE UMA POPULAÇÃO, ou estudo sem nome.
const ESTATISTICA_DE_POPULACAO =
  /\d+(?:[.,]\d+)?\s?%\s+(?:d[aoe]s?|de las|de los|of)\s+(?:\p{L}+\s+)?(?:empresas?|companhias|compa[ñn][ií]as|consumidor[ea]s|usu[aá]rios|usuarios|pessoas|personas|clientes|compradores|brasileiros|espa[ñn]oles|profissionais|profesionales|marketers|pymes|pmes|companies|consumers|users|people|businesses)(?![\p{L}])/iu;
const ESTUDO_SEM_NOME =
  /(?<![\p{L}])(estudos|pesquisas|estudios|investigaciones|encuestas|studies|research)\s+(mostram|indicam|apontam|revelam|muestran|indican|revelan|show|suggest)(?![\p{L}])/iu;
const ATRIBUICAO =
  /(?<![\p{L}])(segundo|según|de acordo com|conforme|fonte|fuente|source|according to|nosso|nossa|nossos|nossas|nuestro|nuestra|nuestros|nuestras)(?![\p{L}])/iu;

export function dadosSemFonte(html: string): string[] {
  return blocos(html)
    .filter(
      (b) =>
        (ESTATISTICA_DE_POPULACAO.test(b.texto) || ESTUDO_SEM_NOME.test(b.texto)) &&
        !/<a\s/i.test(b.html) &&
        !ATRIBUICAO.test(b.texto) &&
        // Citação entre parênteses com nome e ano: "(INE, DIRCE 2025)".
        !/\([^)]*\p{Lu}[^)]*\d{4}[^)]*\)/u.test(b.texto),
    )
    .map((b) => b.texto);
}

// Nomes próprios (maiúscula fora do início da frase) e números por 100
// palavras. Texto que serve para qualquer empresa não nomeia nada: nem
// lugar, nem ferramenta, nem lei, nem valor.
export function densidade(texto: string): number {
  const palavras = texto.split(/\s+/).filter(Boolean);
  if (!palavras.length) return 0;
  let concretos = 0;
  palavras.forEach((p, i) => {
    const inicioDeFrase = i === 0 || /[.!?:]$/.test(palavras[i - 1]);
    if (/\d/.test(p)) concretos++;
    else if (!inicioDeFrase && /^\p{Lu}\p{L}/u.test(p)) concretos++;
  });
  return (concretos / palavras.length) * 100;
}

// Frases todas do mesmo tamanho são a marca mais reconhecível de texto
// escrito por máquina. Desvio-padrão do número de palavras por frase.
export function variacaoDasFrases(texto: string): { frases: number; desvio: number } {
  const tamanhos = texto
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.split(/\s+/).filter(Boolean).length)
    .filter((n) => n >= 3);
  if (!tamanhos.length) return { frases: 0, desvio: 0 };
  const media = tamanhos.reduce((a, b) => a + b, 0) / tamanhos.length;
  const desvio = Math.sqrt(tamanhos.reduce((a, n) => a + (n - media) ** 2, 0) / tamanhos.length);
  return { frases: tamanhos.length, desvio };
}

function linksInternos(html: string, conhecidos: string[]): number {
  const hrefs = [
    ...html.matchAll(/<a[^>]*href\s*=\s*["']([^"']+)["']/gi),
  ].map((m) => m[1]);

  return hrefs.filter(
    (h) =>
      h.startsWith("/") ||
      conhecidos.some(
        (url) => url && h.includes(url.replace(/^https?:\/\//, "")),
      ),
  ).length;
}

// Palavras da pauta que importam. Preposição e artigo ficam de fora: exigir
// "de" e "para" no título transformaria a regra em loteria.
const palavrasDaPauta = (keyword: string) =>
  normalizeText(keyword)
    .split(/\s+/)
    .filter((p) => p.length > 3);

export function avaliarArtigo(artigo: ArtigoParaAvaliar): AvaliacaoDoArtigo {
  const achados: AchadoDoArtigo[] = [];
  const add = (a: AchadoDoArtigo) => achados.push(a);

  const texto = semTags(artigo.html);
  const palavras = contarPalavras(texto);
  const ps = paragrafos(artigo.html);
  const primeiro = ps.find((p) => contarPalavras(p) > 10) ?? ps[0] ?? "";

  // ------------------------------------------------------------- travas
  if (palavras < MIN_PALAVRAS) {
    add({
      codigo: "RASO",
      nivel: "trava",
      titulo: `O artigo tem ${palavras} palavras`,
      comoCorrigir: `Abaixo de ${MIN_PALAVRAS} palavras a nossa própria auditoria acusaria este texto como página rasa no site do cliente. Aprofunde respondendo a dúvida seguinte de quem lê.`,
    });
  }

  if (!/<h2[\s>]/i.test(artigo.html)) {
    add({
      codigo: "SEM_H2",
      nivel: "trava",
      titulo: "Nenhum subtítulo no texto",
      comoCorrigir:
        "Divida em seções com H2 que façam a pergunta do leitor. Texto corrido a IA não recorta para citar, e o leitor não acha o que veio buscar.",
    });
  }

  const internos = linksInternos(artigo.html, artigo.linksConhecidos ?? []);
  if (internos === 0) {
    add({
      codigo: "SEM_LINK_INTERNO",
      nivel: "trava",
      titulo: "Nenhum link para o site do cliente",
      comoCorrigir:
        "Linke de 2 a 4 páginas do site. Sem isso o artigo não distribui autoridade nem leva ninguém para a página que vende.",
    });
  }

  if (artigo.keyword) {
    const alvo = normalizeText(`${artigo.titulo} ${primeiro}`);
    const faltando = palavrasDaPauta(artigo.keyword).filter(
      (p) => !alvo.includes(p),
    );
    if (faltando.length) {
      add({
        codigo: "FORA_DA_PAUTA",
        nivel: "trava",
        titulo: `A pauta "${artigo.keyword}" não aparece no título nem na abertura`,
        comoCorrigir:
          "Reescreva o título e o primeiro parágrafo respondendo à pauta. Texto que não responde o que foi pedido não ranqueia pelo que foi planejado.",
      });
    }
  }

  if (/```|<html[\s>]|<body[\s>]|<head[\s>]/i.test(artigo.html)) {
    add({
      codigo: "HTML_SUJO",
      nivel: "trava",
      titulo: "O conteúdo tem marcação que não deveria estar ali",
      comoCorrigir:
        "Remova blocos de código markdown e tags de documento (html, head, body). Isso aparece cru na página publicada.",
    });
  }

  // ------------------------------------------------------------- avisos
  const t = artigo.seoTitle?.trim() ?? "";
  if (t && (t.length < TITULO_MIN || t.length > TITULO_MAX)) {
    add({
      codigo: "TITULO_SEO",
      nivel: "aviso",
      titulo: `O título de SEO tem ${t.length} caracteres`,
      comoCorrigir: `Entre ${TITULO_MIN} e ${TITULO_MAX} caracteres. Fora disso o Google corta ou reescreve.`,
    });
  }

  const d = artigo.seoDescription?.trim() ?? "";
  if (d && (d.length < META_MIN || d.length > META_MAX)) {
    add({
      codigo: "META_SEO",
      nivel: "aviso",
      titulo: `A meta descrição tem ${d.length} caracteres`,
      comoCorrigir: `Entre ${META_MIN} e ${META_MAX} caracteres. É ela que decide o clique depois que você já apareceu.`,
    });
  }

  const folheto = frasesVazias(texto);
  if (folheto.length >= 2) {
    add({
      codigo: "FOLHETO",
      nivel: "aviso",
      titulo: `Frases de folheto no texto: ${folheto
        .slice(0, 3)
        .map((f) => `"${f}"`)
        .join(", ")}`,
      comoCorrigir:
        "Troque cada uma por um fato verificável. Frase que qualquer concorrente poderia assinar não dá à máquina nada para citar.",
    });
  }

  if (ps.some((p) => contarPalavras(p) > PARAGRAFO_LONGO)) {
    add({
      codigo: "PARAGRAFO_LONGO",
      nivel: "aviso",
      titulo: "Há parágrafo longo demais",
      comoCorrigir:
        "Quebre em blocos menores. A IA cita trecho curto e autossuficiente; parágrafo de dez linhas ela ignora.",
    });
  }

  if (!/<ul[\s>]|<ol[\s>]|<table[\s>]/i.test(artigo.html)) {
    add({
      codigo: "SEM_LISTA",
      nivel: "aviso",
      titulo: "O artigo não tem lista nem tabela",
      comoCorrigir:
        "Uma lista ou tabela com os pontos principais é o formato que a IA mais recorta para responder.",
    });
  }

  // Número é o rastro de conteúdo com substância: preço, prazo, quantidade,
  // ano. Texto inteiro sem nenhum costuma ser o texto que serve para
  // qualquer empresa.
  if ((texto.match(/\d+/g) ?? []).length < MIN_NUMEROS) {
    add({
      codigo: "SEM_DADO",
      nivel: "aviso",
      titulo: "Nenhum dado concreto no texto",
      comoCorrigir:
        "Inclua número, prazo, preço ou caso real. É o que o concorrente não copia e o que o Google recompensa.",
    });
  }

  const semFonte = dadosSemFonte(artigo.html);
  if (semFonte.length) {
    const trecho = semFonte[0].length > 90 ? `${semFonte[0].slice(0, 90)}…` : semFonte[0];
    add({
      codigo: "DADO_SEM_FONTE",
      nivel: "aviso",
      titulo: `${semFonte.length === 1 ? "Um dado" : `${semFonte.length} dados`} sem fonte: "${trecho}"`,
      comoCorrigir:
        'Diga de onde vem o número (com link, ou "segundo o INE", "nos nossos clientes") ou tire o número. Dado sem dono o leitor não confere, e se foi inventado é a credibilidade do cliente que vai junto.',
    });
  }

  if (palavras >= MIN_PALAVRAS && densidade(texto) < MIN_DENSIDADE) {
    add({
      codigo: "GENERICO",
      nivel: "aviso",
      titulo: "O texto quase não nomeia nada concreto",
      comoCorrigir:
        "Cite lugares, ferramentas, leis, marcas, valores e prazos. Texto sem nome próprio nem número serve para qualquer empresa e não dá à IA nada que valha citar.",
    });
  }

  const ritmo = variacaoDasFrases(texto);
  if (ritmo.frases >= MIN_FRASES_RITMO && ritmo.desvio < RITMO_MINIMO) {
    add({
      codigo: "RITMO_DE_MAQUINA",
      nivel: "aviso",
      titulo: "As frases têm todas o mesmo tamanho",
      comoCorrigir:
        "Alterne frases curtas com outras mais longas. Ritmo uniforme é o traço que mais denuncia texto escrito por IA, e cansa quem lê.",
    });
  }

  if (artigo.keyword && artigo.keywordsPublicadas?.length) {
    const alvo = normalizeText(artigo.keyword);
    if (artigo.keywordsPublicadas.some((k) => normalizeText(k) === alvo)) {
      add({
        codigo: "CANIBALIZACAO",
        nivel: "aviso",
        titulo: "Já existe artigo publicado com esta mesma pauta",
        comoCorrigir:
          "Dois textos seus disputando o mesmo termo dividem força. Mude o ângulo desta pauta ou atualize o artigo antigo em vez de publicar outro.",
      });
    }
  }

  const travas = achados.filter((a) => a.nivel === "trava");
  return {
    travas,
    avisos: achados.filter((a) => a.nivel === "aviso"),
    palavras,
    podePublicar: travas.length === 0,
  };
}
