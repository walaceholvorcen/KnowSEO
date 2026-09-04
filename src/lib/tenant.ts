import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Caso 3: domínio próprio do cliente já conectado
  const { data } = await admin
    .from("blogs")
    .select("*")
    .eq("custom_domain", hostname)
    .maybeSingle();

  return (data as Blog) ?? null;
}
