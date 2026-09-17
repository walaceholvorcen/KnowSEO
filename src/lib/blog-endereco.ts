import type { DomainStatus } from "@/types";
import { isSafeCustomDomain } from "./dominio.ts";
import { slugify } from "./utils.ts";

type BlogEndereco = {
  subdomain: string;
  custom_domain: string | null;
  domain_status: DomainStatus;
};

export type UrlPublica = {
  /** Com esquema e sem barra final. */
  url: string;
  kind: "custom" | "path";
  verified: boolean;
};

/**
 * Onde o blog está de fato no ar - a mesma regra para painel, canonical,
 * sitemap, script de regressão e redirecionamento de slug antigo.
 *
 * 1. Domínio próprio, só se for subdomínio seguro E verificado ('active',
 *    que só a checagem /api/blog/verificar-dominio escreve). Antes disso o
 *    site do cliente responde 200 para qualquer caminho, e um link montado
 *    com ele "funciona" abrindo a página errada, calado.
 * 2. Caminho na plataforma: https://<app>/b/<slug>. Sempre funciona. O
 *    subdomínio "<slug>.knowseo.vercel.app" morria no TLS - o certificado
 *    *.vercel.app cobre um nível só - e /b/ (não /<slug>) não colide com
 *    rotas do app.
 */
export function urlPublicaDoBlog(
  blog: BlogEndereco,
  appDomain = dominioDoApp(),
): UrlPublica {
  if (
    blog.custom_domain &&
    blog.domain_status === "active" &&
    isSafeCustomDomain(blog.custom_domain)
  ) {
    return { url: `https://${blog.custom_domain}`, kind: "custom", verified: true };
  }
  const esquema = appDomain.includes("localhost") ? "http" : "https";
  return {
    url: `${esquema}://${appDomain}/b/${blog.subdomain}`,
    kind: "path",
    verified: false,
  };
}

export function urlDoArtigo(
  blog: BlogEndereco,
  slug: string,
  appDomain = dominioDoApp(),
): string {
  return `${urlPublicaDoBlog(blog, appDomain).url}/${slug}`;
}

/** A URL para mostrar em texto: sem o "https://". */
export function semEsquema(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * Sem o domínio do app configurado o endereço vira "localhost:3000/b/x" - e
 * a tela de Relatórios entrega esse link ao cliente como se fosse o blog no
 * ar. Na Vercel, VERCEL_PROJECT_PRODUCTION_URL é o domínio de produção do
 * projeto e cobre a variável esquecida; fora dela, em produção, é erro.
 */
function dominioDoApp(): string {
  const dominio =
    process.env.NEXT_PUBLIC_APP_DOMAIN || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (dominio) return dominio;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_DOMAIN não configurada: o endereço público do blog sairia como localhost.",
    );
  }
  return "localhost:3000";
}

// Primeiro segmento de caminhos e hosts que já têm dono: "/b/app" ou um
// blog chamado "api" confundiriam quem lê o endereço e o proxy.
export const SLUGS_RESERVADOS = [
  "www", "app", "api", "admin", "b", "blog", "login", "dashboard",
];

/** Mensagem do problema com o slug, ou null se ele serve. Colisão com
 *  outro blog depende do banco e é conferida na rota de servidor. */
export function erroNoSlug(slug: string): string | null {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return "Use de 3 a 40 caracteres: letras minúsculas sem acento, números e hífen.";
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return "O endereço não pode começar nem terminar com hífen.";
  }
  if (SLUGS_RESERVADOS.includes(slug)) {
    return "Esse endereço é reservado pela plataforma. Escolha outro.";
  }
  return null;
}

/** Slug inicial a partir do nome do cliente - editável no cadastro. */
export function slugDoNome(nome: string): string {
  return slugify(nome).slice(0, 40).replace(/-+$/, "");
}

/**
 * Lista de slugs antigos depois de renomear: o antigo entra (para o 301) e o
 * novo sai - voltar a um nome já usado não pode redirecionar para si mesmo.
 */
export function slugsAposRenomear(
  anteriores: string[],
  antigo: string,
  novo: string,
): string[] {
  return [...new Set([...anteriores, antigo])].filter((s) => s !== novo);
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
