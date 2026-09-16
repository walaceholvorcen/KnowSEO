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
  rootDomain = raizPadrao(),
): string {
  if (blog.custom_domain && blog.domain_status === "active") {
    return blog.custom_domain;
  }
  return `${blog.subdomain}.${rootDomain}`;
}

/**
 * Sem a raiz configurada o endereço vira "x.localhost:3000" - e a tela de
 * Relatórios entrega esse link ao cliente como se fosse o blog no ar. Em
 * produção isso é um erro de configuração, não um padrão aceitável.
 */
function raizPadrao(): string {
  const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (raiz) return raiz;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_ROOT_DOMAIN não configurada: o endereço público do blog sairia como localhost.",
    );
  }
  return "localhost:3000";
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
  theme: {
    primary_color: string;
    secondary_color?: string | null;
    logo_ratio?: number | null;
    logo_url: string | null;
  };
}): string {
  // A capa e o carrossel também desenham com a cor secundária e com a
  // proporção do logo: fora do hash, trocar qualquer uma das duas servia
  // imagem velha pelo cache de um dia.
  const texto = [
    blog.name,
    blog.theme.primary_color,
    blog.theme.secondary_color ?? "",
    blog.theme.logo_ratio ?? "",
    blog.theme.logo_url ?? "",
  ].join("|");
  let h = 5381;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/** Cache das imagens geradas (capa e carrossel) - ver versaoDaIdentidade. */
export const CACHE_DA_CAPA =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate";
