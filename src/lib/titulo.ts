import { htmlParaTexto } from "./utils.ts";

// Título de uma página para a linkagem interna.
//
// Site feito como SPA (Lovable, Vite sem prerender) devolve o MESMO
// index.html para toda rota: o <title> de /metodologia é o da home, e o
// título real só existe depois do JS rodar. Foi assim que as 5 páginas do
// dataknow.es ficaram todas com o título da home. Aqui, quando o <title> de
// uma página interna repete o da home, cai para og:title, depois h1 e, se
// tudo repetir, deriva do caminho ("/sobre-nosotros" → "Sobre nosotros").
// Um título derivado ainda é âncora melhor que o da home repetida.

function texto(html: string, re: RegExp): string | null {
  const m = html.match(re);
  if (!m) return null;
  const limpo = htmlParaTexto(m[1]).replace(/\s+/g, " ").trim();
  return limpo || null;
}

/** Última parte do caminho como frase: "gestion-de-performance" → "Gestion de performance". */
export function tituloDoCaminho(url: string): string | null {
  let caminho: string;
  try {
    caminho = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  const ultimo = caminho.split("/").filter(Boolean).pop() ?? "";
  const frase = ultimo.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return frase ? frase[0].toUpperCase() + frase.slice(1) : null;
}

/**
 * @param tituloDaHome <title> lido na home; null quando a página É a home.
 */
export function tituloDaPagina(
  html: string,
  url: string,
  tituloDaHome: string | null,
): string | null {
  const candidatos = [
    texto(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    texto(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i),
    texto(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
  ];
  const repeteHome = (t: string) =>
    tituloDaHome !== null && t.toLowerCase() === tituloDaHome.toLowerCase();

  const proprio = candidatos.find((c) => c && !repeteHome(c));
  if (proprio) return proprio;
  // Só chega aqui página interna cujo título é o da home (ou sem título).
  return tituloDaHome === null ? null : tituloDoCaminho(url);
}
