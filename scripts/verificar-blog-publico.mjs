// Regressão do endereço público: para cada blog com artigo publicado, monta
// a URL com a MESMA regra do painel (importa src/lib/blog-endereco.ts - o
// Node 24 remove os tipos sozinho) e faz GET de verdade na home e num
// artigo. Nasceu de testando.knowseo.vercel.app, que o painel oferecia e
// morria no TLS sem ninguém perceber.
//
// Uso: npm run test:blog   (APP_DOMAIN=outro.dominio para outro ambiente)
import { lerEnv } from "./env.mjs";
import { urlDoArtigo, urlPublicaDoBlog } from "../src/lib/blog-endereco.ts";

const { env, rest } = lerEnv();
// O .env.local aponta para localhost; a regressão vale para produção.
const app = env.APP_DOMAIN || "know-seo.vercel.app";

const blogs = await (await rest("blogs?select=id,subdomain,custom_domain,domain_status")).json();
const artigos = await (
  await rest("articles?select=blog_id,slug&status=eq.published&order=published_at.desc")
).json();
if (!Array.isArray(blogs) || !Array.isArray(artigos)) {
  console.error("Falha ao ler o Supabase:", blogs.message ?? artigos.message);
  process.exit(1);
}

let falhas = 0;
async function conferir(rotulo, url, canonicalEsperado) {
  let status = "sem resposta";
  let ok = false;
  let nota = "";
  try {
    // redirect manual: um 301/307 aqui é regressão, não sucesso.
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    status = res.status;
    ok = res.ok;
    if (ok && canonicalEsperado) {
      const html = await res.text();
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      if (canonical !== canonicalEsperado) {
        ok = false;
        nota = ` canonical=${canonical ?? "ausente"}`;
      }
    }
  } catch (e) {
    nota = ` ${e.cause?.code ?? e.message}`;
  }
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${status} ${rotulo} ${url}${nota}`);
}

for (const blog of blogs) {
  const artigo = artigos.find((a) => a.blog_id === blog.id);
  if (!artigo) continue;
  const base = urlPublicaDoBlog(blog, app);
  console.log(`\n${blog.subdomain} (${base.kind}${base.verified ? ", verificado" : ""})`);
  await conferir("home  ", base.url, base.url);
  await conferir("artigo", urlDoArtigo(blog, artigo.slug, app), urlDoArtigo(blog, artigo.slug, app));
}

console.log(falhas ? `\n${falhas} falha(s).` : "\nTodos os blogs públicos respondem.");
process.exit(falhas ? 1 : 0);
