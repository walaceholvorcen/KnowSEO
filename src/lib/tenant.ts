import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSafeCustomDomain } from "@/lib/dominio";
import type { Blog } from "@/types";

// Header injetado pelo proxy na rota de preview (/b/<subdominio>) com a
// base pública real. Sem isso, sitemap, canonical e og:image apontariam
// para um subdomínio que não existe em ambientes sem wildcard (.vercel.app).
export const TENANT_BASE_HEADER = "x-tenant-base";

// Origem absoluta do blog do cliente, sem barra final.
export async function tenantOrigin(host: string): Promise<string> {
  const headerList = await headers();
  const previewBase = headerList.get(TENANT_BASE_HEADER);
  if (previewBase) return previewBase.replace(/\/$/, "");

  const decodedHost = decodeURIComponent(host);
  const isLocal = decodedHost.includes("localhost");
  return `${isLocal ? "http" : "https"}://${decodedHost}`;
}

export async function tenantBaseUrl(host: string): Promise<URL> {
  return new URL(await tenantOrigin(host));
}

// Origem para servir assets da aplicação (capa gerada em /api/og).
//
// Na rota de preview a base do tenant inclui um caminho
// ("https://app.com/b/cliente"), e uma URL relativa resolvida contra ela
// vira "/b/cliente/api/og/..." - que não existe. A capa mora na raiz do
// app, então aqui devolvemos só esquema + host.
export async function tenantAssetOrigin(host: string): Promise<string> {
  return new URL(await tenantOrigin(host)).origin;
}

// Resolve qual blog corresponde ao segmento recebido do proxy.
//
// Aceita duas formas:
//   - subdomínio puro ("demo")            -> rota de preview /b/demo
//   - host completo ("demo.dominio.com")  -> subdomínio ou domínio próprio
export async function resolveBlogByHost(host: string): Promise<Blog | null> {
  const admin = createAdminClient();

  // A porta pode vir percent-encoded ("host.localhost%3A3000"); sem o
  // decode o split(":") não separa a porta e o subdomínio nunca é extraído.
  const decodedHost = decodeURIComponent(host);
  const hostname = decodedHost.split(":")[0];

  const bySubdomain = async (subdomain: string) => {
    const { data } = await admin
      .from("blogs")
      .select("*")
      .eq("subdomain", subdomain)
      .maybeSingle();
    return (data as Blog) ?? null;
  };

  // Caso 1: subdomínio puro (sem ponto) - vem da rota de preview
  if (!hostname.includes(".")) {
    return bySubdomain(hostname);
  }

  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").split(
    ":",
  )[0];

  // Caso 2: subdomínio nosso -> "cliente-x.nossodominio.com"
  if (hostname.endsWith(`.${rootDomain}`)) {
    const blog = await bySubdomain(hostname.slice(0, -(rootDomain.length + 1)));
    if (blog) return blog;
  }

  // Caso 3: domínio próprio do cliente já conectado. Apex, www ou
  // .vercel.app gravados por engano (antes da guarda no servidor) nunca são
  // servidos: responder ali seria substituir o site do cliente pelo blog.
  if (!isSafeCustomDomain(hostname)) return null;
  const { data } = await admin
    .from("blogs")
    .select("*")
    .eq("custom_domain", hostname)
    .maybeSingle();

  return (data as Blog) ?? null;
}

/**
 * Blog que usava este slug antes de ser renomeado - para o 301 de
 * /b/<antigo>. Qualquer erro (inclusive a coluna slugs_anteriores ainda não
 * existir, antes da migração 0012) vale como "sem redirecionamento": o
 * visitante recebe o 404 de sempre, nunca um 500. Se algum blog usa esse
 * slug HOJE, ele vence: o cadastro não enxerga slugs antigos de outras
 * agências (RLS), e redirecionar o dono atual seria sequestrar o blog dele.
 */
export async function blogPorSlugAntigo(
  slug: string,
): Promise<Pick<Blog, "subdomain" | "custom_domain" | "domain_status"> | null> {
  // O slug vem da URL e entra no filtro: só o formato válido chega lá.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const { data, error } = await createAdminClient()
    .from("blogs")
    .select("subdomain, custom_domain, domain_status")
    .or(`subdomain.eq.${slug},slugs_anteriores.cs.{${slug}}`)
    .limit(2);
  if (error || !data?.length || data.some((b) => b.subdomain === slug)) {
    return null;
  }
  // Mesmo slug antigo em mais de um blog (renomeações cruzadas, ou gravação
  // anterior à checagem de colisão): qualquer escolha seria arbitrária e o
  // 301 poderia entregar o visitante a outro cliente. Sem redirecionamento.
  if (data.length > 1) {
    console.warn(`[slug antigo] "${slug}" consta em mais de um blog; 301 suspenso.`);
    return null;
  }
  return data[0] as Pick<Blog, "subdomain" | "custom_domain" | "domain_status">;
}
