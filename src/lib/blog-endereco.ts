import type { DomainStatus } from "@/types";

/**
 * O host onde o blog está de fato no ar. O domínio próprio só conta depois
 * do DNS confirmado: antes disso o site do cliente responde 200 na home para
 * qualquer caminho, e um link montado com ele "funciona" abrindo a página
 * errada, calado.
 */
export function enderecoDoBlog(
  blog: {
    subdomain: string;
    custom_domain: string | null;
    domain_status: DomainStatus;
  },
  rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000",
): string {
  if (blog.custom_domain && blog.domain_status === "active") {
    return blog.custom_domain;
  }
  return `${blog.subdomain}.${rootDomain}`;
}

/**
 * Versão curta da identidade visual do blog, para carimbar a URL da capa
 * gerada (`/api/og/:id?v=...`). A capa é desenhada na hora com nome, cor e
 * logo; sem a versão na URL, navegador e CDN seguem servindo a capa antiga
 * depois que o cliente troca a marca. Hash djb2 - só precisa mudar quando a
 * identidade muda, não ser criptográfico.
 */
export function versaoDaIdentidade(blog: {
  name: string;
  theme: { primary_color: string; logo_url: string | null };
}): string {
  const texto = `${blog.name}|${blog.theme.primary_color}|${blog.theme.logo_url ?? ""}`;
  let h = 5381;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/** Cache das imagens geradas (capa e carrossel) - ver versaoDaIdentidade. */
export const CACHE_DA_CAPA =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate";
