import { createHash } from "node:crypto";
import { urlPublicaDoBlog, type BlogEndereco } from "./blog-endereco.ts";

// IndexNow: avisa o Bing (e quem participa do protocolo: Yandex, Seznam,
// Naver) de que um endereço é novo ou mudou. O Bing é a base do Copilot e
// de parte das buscas do ChatGPT; sem o aviso, um blog sem link de entrada
// espera semanas pela visita do robô. O Google não participa.
//
// A chave prova que quem avisa é dono do site: o motor busca o arquivo
// `indexnow.txt` no próprio blog e confere o conteúdo. Derivada do id do
// blog, sem segredo para guardar - a chave é pública por definição (fica num
// arquivo aberto), só precisa ser estável e única por blog.
export function chaveIndexNow(blogId: string): string {
  return createHash("sha256").update(`indexnow:${blogId}`).digest("hex").slice(0, 32);
}

/** O que mandar, ou null quando não há o que avisar. Separado para testar. */
export function pedidoIndexNow(
  blog: BlogEndereco & { id: string },
  slugs: string[],
): { host: string; key: string; keyLocation: string; urlList: string[] } | null {
  const publica = urlPublicaDoBlog(blog);
  // Blog ainda no endereço da plataforma (/b/...) é prévia fora do Google e
  // do Bing (noindex, PROCESSO 63): avisar seria pedir para indexar o que a
  // própria página recusa.
  if (publica.kind === "path" || !slugs.length) return null;
  return {
    host: new URL(publica.url).host,
    key: chaveIndexNow(blog.id),
    keyLocation: `${publica.url}/indexnow.txt`,
    urlList: [publica.url, ...slugs.map((s) => `${publica.url}/${s}`)],
  };
}

/** Nunca lança: o aviso é cortesia ao buscador, publicar não depende dele. */
export async function avisarIndexNow(blog: BlogEndereco & { id: string }, slugs: string[]): Promise<void> {
  // Só produção: em ambiente local o endereço do blog é o de produção, e o
  // aviso sairia em nome do site do cliente para um artigo que não mudou lá.
  if (process.env.VERCEL_ENV !== "production") return;
  const pedido = pedidoIndexNow(blog, slugs);
  if (!pedido) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(pedido),
      signal: AbortSignal.timeout(8000),
    });
    // 200 e 202 são aceite. 403 = chave não conferiu (arquivo fora do ar);
    // 422 = endereço fora do host. Fica no log para dar para investigar.
    if (res.status !== 200 && res.status !== 202) {
      console.warn("[indexnow] recusado", res.status, pedido.host, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.warn("[indexnow] falhou", pedido.host, err);
  }
}
