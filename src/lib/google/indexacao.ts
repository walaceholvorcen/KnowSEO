// "O Google conhece este blog?" - a pergunta que o produto não fazia.
//
// Publicar terminava em "está no ar". Em 19/11/2026 a inspeção do Search
// Console mostrou treze artigos da DataKnow, no ar havia seis semanas, como
// "URL is unknown to Google": ninguém tinha enviado o sitemap do blog e o
// site do cliente não tinha link para ele. Zero visita não era falta de
// interesse - o Google não sabia que as páginas existiam.
//
// Função pura: recebe o que o Google respondeu e devolve o que a tela diz.

export type EstadoDaUrl = "indexado" | "nao_indexado" | "desconhecido";

export interface SitemapNoGoogle {
  path: string;
  /** O Google ainda não leu o arquivo depois do envio. */
  pendente: boolean;
  erros: number;
  ultimaLeitura: string | null;
}

export interface Indexacao {
  sitemap: "enviado" | "aguardando" | "com-erro" | "nao-enviado";
  conferidos: number;
  indexados: number;
  /** Conferidos que o Google respondeu "não indexado" ou "não conheço". */
  fora: number;
  /** Não deu para conferir (cota, falha de rede): não conta para nenhum lado. */
  semResposta: number;
  veredito: string;
  /** O que fazer, em ordem. Vazio quando está tudo certo. */
  passos: string[];
}

export function resumirIndexacao(params: {
  /** Endereço do sitemap do blog: "https://blog.cliente.com/sitemap.xml". */
  sitemapDoBlog: string;
  sitemaps: SitemapNoGoogle[];
  estados: EstadoDaUrl[];
}): Indexacao {
  const { sitemapDoBlog, sitemaps, estados } = params;

  const achado = sitemaps.find((s) => semBarra(s.path) === semBarra(sitemapDoBlog));
  const sitemap: Indexacao["sitemap"] = !achado
    ? "nao-enviado"
    : achado.erros > 0
      ? "com-erro"
      : achado.pendente || !achado.ultimaLeitura
        ? "aguardando"
        : "enviado";

  const indexados = estados.filter((e) => e === "indexado").length;
  const fora = estados.filter((e) => e === "nao_indexado").length;
  const semResposta = estados.filter((e) => e === "desconhecido").length;
  const conferidos = indexados + fora;

  const passos: string[] = [];
  if (sitemap === "nao-enviado") {
    passos.push(
      `No Search Console, em Sitemaps, envie ${sitemapDoBlog}. É o que avisa o Google de que o blog existe.`,
    );
  } else if (sitemap === "com-erro") {
    passos.push("O Google acusou erro ao ler o sitemap do blog. Abra Sitemaps no Search Console para ver qual.");
  }
  if (fora > 0) {
    passos.push(
      "Peça ao cliente um link para o blog no site dele (menu ou rodapé). Sem nenhum link apontando, o Google demora a visitar um endereço novo.",
    );
  }

  let veredito: string;
  if (conferidos === 0) {
    veredito = "Ainda não deu para conferir com o Google se os artigos estão indexados.";
  } else if (indexados === 0) {
    veredito = `O Google não conhece nenhum dos ${conferidos} artigos conferidos. Eles estão no ar, mas não aparecem na busca.`;
  } else if (fora === 0) {
    veredito = `Os ${conferidos} artigos conferidos estão indexados no Google.`;
  } else {
    veredito = `O Google indexou ${indexados} de ${conferidos} artigos conferidos.`;
  }
  if (sitemap === "aguardando" && fora > 0) {
    veredito += " O sitemap já foi enviado e o Google ainda não o leu - costuma levar de um a alguns dias.";
  }

  return { sitemap, conferidos, indexados, fora, semResposta, veredito, passos };
}

function semBarra(endereco: string): string {
  return endereco.replace(/\/+$/, "").toLowerCase();
}
