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
