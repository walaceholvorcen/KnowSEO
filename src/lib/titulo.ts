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
 * @returns `suspeita` quando tudo repetia a home e o título veio do caminho:
 *   o endereço pode estar servindo a própria home (SPA ou soft 404), e
 *   quem grava precisa poder dizer isso em vez de fingir um título lido.
 */
export function tituloDaPagina(
  html: string,
  url: string,
  tituloDaHome: string | null,
): { titulo: string | null; suspeita: boolean } {
  const candidatos = [
    texto(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    texto(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i),
    texto(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
  ];
  const repeteHome = (t: string) =>
    tituloDaHome !== null && t.toLowerCase() === tituloDaHome.toLowerCase();

  const proprio = candidatos.find((c) => c && !repeteHome(c));
  if (proprio) return { titulo: proprio, suspeita: false };
  // Só chega aqui página interna cujo título é o da home (ou sem título).
  if (tituloDaHome === null) return { titulo: null, suspeita: false };
  return { titulo: tituloDoCaminho(url), suspeita: true };
}

// Na tela de linkagem interna, a partir do que está gravado (sem coluna
// nova): página cujo título é idêntico ao de outra página mapeada é
// suspeita - os registros de crawl antigo gravaram o título da home em
// todas. A home em si (caminho "/") não é suspeita de repetir a si mesma.
export function titulosSuspeitos(
  paginas: { id: string; url: string; title: string | null }[],
): Set<string> {
  const porTitulo = new Map<string, typeof paginas>();
  for (const p of paginas) {
    const chave = p.title?.trim().toLowerCase();
    if (!chave) continue;
    porTitulo.set(chave, [...(porTitulo.get(chave) ?? []), p]);
  }
  const ehHome = (url: string) => {
    try {
      return new URL(url).pathname.replace(/\/+$/, "") === "";
    } catch {
      return false;
    }
  };
  const suspeitos = new Set<string>();
  for (const grupo of porTitulo.values()) {
    if (grupo.length < 2) continue;
    for (const p of grupo) if (!ehHome(p.url)) suspeitos.add(p.id);
  }
  return suspeitos;
}
