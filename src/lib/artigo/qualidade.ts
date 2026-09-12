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
