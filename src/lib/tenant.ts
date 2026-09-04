import { createAdminClient } from "@/lib/supabase/admin";
import type { Blog } from "@/types";

// Resolve qual blog corresponde ao host recebido pelo middleware
// (subdomínio nosso ou domínio próprio já conectado pelo cliente).
// Usa o client admin porque essa resolução acontece antes de qualquer
// sessão de usuário existir (visitante anônimo do blog público).
// Base absoluta do próprio blog do cliente, usada pelo Next para resolver
// URLs relativas nas metatags (og:image etc). Sem isso ele assume
// localhost e o preview de compartilhamento quebra em produção.
export function tenantBaseUrl(host: string): URL {
  return new URL(tenantOrigin(host));
}

// Origem absoluta do blog do cliente, sem barra final.
export function tenantOrigin(host: string): string {
  const decodedHost = decodeURIComponent(host);
  const isLocal = decodedHost.includes("localhost");
  return `${isLocal ? "http" : "https"}://${decodedHost}`;
}

export async function resolveBlogByHost(host: string): Promise<Blog | null> {
  const admin = createAdminClient();

  // O host chega como segmento de URL vindo do rewrite do proxy, então a
  // porta pode vir percent-encoded ("host.localhost%3A3000"). Sem o
  // decode, o split(":") não separa a porta e o subdomínio nunca é
  // extraído - o blog do cliente cai em 404.
  const decodedHost = decodeURIComponent(host);
  const hostname = decodedHost.split(":")[0];
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").split(
    ":",
  )[0];

  // Caso 1: subdomínio nosso -> "cliente-x.nossodominio.com"
  if (hostname.endsWith(`.${rootDomain}`)) {
    const subdomain = hostname.slice(0, -(rootDomain.length + 1));
    const { data } = await admin
      .from("blogs")
      .select("*")
      .eq("subdomain", subdomain)
      .maybeSingle();
    if (data) return data as Blog;
  }

  // Caso 2: domínio próprio do cliente já conectado
  const { data } = await admin
    .from("blogs")
    .select("*")
    .eq("custom_domain", hostname)
    .maybeSingle();

  return (data as Blog) ?? null;
}
