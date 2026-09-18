import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { TENANT_BASE_HEADER, blogPorPasta, blogPorSlugAntigo } from "@/lib/tenant";
import { origemDoApp, urlPublicaDoBlog } from "@/lib/blog-endereco";
import { CABECALHO_PASTA, ROTA_DA_PASTA } from "@/lib/pasta";
import { CABECALHO_CSP, novoNonce, politicaDeSeguranca } from "@/lib/csp";

// Host da aplicação principal (dashboard). Tudo que chegar em outro host
// é tratado como o blog público de um tenant e é reescrito para
// /_sites/<host>/<resto-do-path>, onde o app resolve qual blog servir.
//
// Dev local: acesse o app em http://localhost:3000 e um blog de teste em
// http://cliente-teste.localhost:3000 (subdomínios *.localhost funcionam
// nativamente no Chrome/Edge/Firefox, sem precisar editar hosts file).
//
// Nota Next.js 16: este arquivo é o antigo "middleware.ts" - o convention
// name foi renomeado para "proxy.ts" (função exportada `proxy`, não mais
// `middleware`). Mesma matcher API, mesmo comportamento.
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000";

// Rotas que precisam responder normalmente mesmo quando acessadas a partir
// do host de um tenant (blog do cliente), sem cair no rewrite para /sites.
const PUBLIC_APP_PATHS = [
  "/_next",
  "/favicon.ico",
  "/api/track", // analytics de primeira parte
  "/api/og", // capa gerada do artigo (também usada como preview no OG)
];

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";
  const pathname = url.pathname;

  const isAppHost =
    hostname === APP_DOMAIN ||
    hostname === `www.${APP_DOMAIN}` ||
    hostname.endsWith(".vercel.app"); // preview deployments

  const isInternal = PUBLIC_APP_PATHS.some((p) => pathname.startsWith(p));

  // Nonce novo a cada pedido, no pedido (o Next lê para marcar os próprios
  // scripts) e na resposta (o navegador aplica). Vale para os três caminhos
  // abaixo: painel, blog por /b/ e blog em domínio do cliente.
  const nonce = novoNonce();
  const csp = politicaDeSeguranca(
    nonce,
    process.env.NODE_ENV === "development",
    origemDoApp(),
  );
  const comCsp = (headers: Headers) => {
    headers.set(CABECALHO_CSP, csp);
    headers.set("x-nonce", nonce);
    return headers;
  };
  const responder = (r: NextResponse) => {
    r.headers.set(CABECALHO_CSP, csp);
    return r;
  };

  // Blog numa pasta do site do cliente (cliente.com/blog). Quem chega aqui é
  // o Worker do Cloudflare dele (src/lib/pasta.ts), dizendo de qual pasta
  // veio. Sem cabeçalho, ou com um endereço que não é de nenhum blog, é 404
  // - a rota não existe para quem digita o endereço do app direto.
  const pastaMatch = pathname.match(new RegExp(`^${ROTA_DA_PASTA}(/.*)?$`));
  if (isAppHost && pastaMatch) {
    const blog = await blogPorPasta(request.headers.get(CABECALHO_PASTA));
    if (!blog) return new NextResponse("Not Found", { status: 404 });

    const [, rawRest = "/"] = pastaMatch;
    const rest = rawRest === "/sitemap.xml" ? "/sitemap" : rawRest;
    const destino = new URL(`/sites/${blog.subdomain}${rest === "/" ? "" : rest}`, request.url);
    destino.search = url.search;

    // A base dos links é a pasta: o visitante está em cliente.com/blog e
    // continua lá ao clicar num artigo. Seguro porque blogPorPasta só
    // devolve blog quando o endereço é exatamente o cadastrado.
    const requestHeaders = comCsp(new Headers(request.headers));
    requestHeaders.set(TENANT_BASE_HEADER, blog.pasta_url);
    return responder(
      NextResponse.rewrite(destino, { request: { headers: requestHeaders } }),
    );
  }

  // Pré-visualização por caminho: /b/<subdominio>/<resto>
  //
  // Domínios .vercel.app não aceitam wildcard, então em ambiente de teste
  // não existe "cliente.meuapp.vercel.app". Esta rota dá acesso ao blog do
  // tenant sem depender de subdomínio. Com domínio próprio configurado, os
  // subdomínios reais funcionam normalmente e isto continua valendo como
  // atalho de preview.
  const previewMatch = pathname.match(/^\/b\/([^/]+)(\/.*)?$/);
  if (isAppHost && previewMatch) {
    const [, subdomain, rawRest = "/"] = previewMatch;

    // Slug renomeado: /b/<antigo>[/artigo] responde 301 para o endereço
    // novo, senão todo link já indexado e compartilhado vira 404. 301 aqui
    // e não permanentRedirect() na página, porque aquele devolve 308 e o
    // pedido é 301 - o código que buscador e encurtador conhecem há mais
    // tempo. Blog que usa o slug hoje vence (ver blogPorSlugAntigo).
    // ponytail: uma consulta indexada por visita ao blog; cache por slug se
    // o tempo de resposta do blog público pesar.
    const renomeado = await blogPorSlugAntigo(subdomain);
    if (renomeado) {
      const destino = `${urlPublicaDoBlog(renomeado, hostname).url}${rawRest === "/" ? "" : rawRest}${url.search}`;
      return NextResponse.redirect(destino, 301);
    }
    const rest = rawRest === "/sitemap.xml" ? "/sitemap" : rawRest;

    const previewUrl = new URL(
      `/sites/${subdomain}${rest === "/" ? "" : rest}`,
      request.url,
    );
    previewUrl.search = url.search;

    // Informa a base pública real para que sitemap, canonical e og:image
    // não apontem para um subdomínio inexistente.
    const requestHeaders = comCsp(new Headers(request.headers));
    requestHeaders.set(
      TENANT_BASE_HEADER,
      `${url.protocol}//${hostname}/b/${subdomain}`,
    );

    return responder(
      NextResponse.rewrite(previewUrl, {
        request: { headers: requestHeaders },
      }),
    );
  }

  if (isAppHost || isInternal) {
    // Fluxo normal do app (dashboard/auth) - mantém sessão do Supabase viva.
    const { response } = await updateSession(request, {
      [CABECALHO_CSP]: csp,
      "x-nonce": nonce,
    });
    return responder(response);
  }

  // Qualquer outro host = blog público de um tenant (subdomínio nosso ou
  // domínio próprio já conectado). Reescreve internamente, sem redirect
  // visível, preservando a URL que o visitante vê.
  //
  // Nota: a pasta é "sites" (sem underscore) porque "_sites" é tratada
  // pelo Next.js como pasta privada (não roteável) - um `_folder` nunca
  // vira uma rota real, então o rewrite cairia em 404 silencioso.
  // "sitemap.xml" é tratado pelo Next como arquivo de metadata e tem a
  // rota normalizada (o [domain] vira "-"), o que serviria o mesmo
  // sitemap para todos os tenants. Por isso a pasta se chama "sitemap" e
  // o caminho público é mapeado aqui.
  const targetPath = pathname === "/sitemap.xml" ? "/sitemap" : pathname;

  const rewrittenUrl = new URL(
    `/sites/${hostname}${targetPath}`,
    request.url,
  );
  rewrittenUrl.search = url.search;

  return responder(
    NextResponse.rewrite(rewrittenUrl, {
      request: { headers: comCsp(new Headers(request.headers)) },
    }),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
