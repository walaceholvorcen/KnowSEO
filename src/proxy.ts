import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { TENANT_BASE_HEADER } from "@/lib/tenant";

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
    const rest = rawRest === "/sitemap.xml" ? "/sitemap" : rawRest;

    const previewUrl = new URL(
      `/sites/${subdomain}${rest === "/" ? "" : rest}`,
      request.url,
    );
    previewUrl.search = url.search;

    // Informa a base pública real para que sitemap, canonical e og:image
    // não apontem para um subdomínio inexistente.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(
      TENANT_BASE_HEADER,
      `${url.protocol}//${hostname}/b/${subdomain}`,
    );

    return NextResponse.rewrite(previewUrl, {
      request: { headers: requestHeaders },
    });
  }

  if (isAppHost || isInternal) {
    // Fluxo normal do app (dashboard/auth) - mantém sessão do Supabase viva.
    const { response } = await updateSession(request);
    return response;
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

  return NextResponse.rewrite(rewrittenUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
