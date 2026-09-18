import { notFound } from "next/navigation";
import { jsonParaScript } from "@/lib/html-seguro";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBlogByHost, tenantOrigin } from "@/lib/tenant";
import { ArticleView } from "@/components/article-view";
import {
  origemDoApp,
  siteDoCliente,
  urlDoArtigo,
  urlPublicaDoBlog,
  versaoDaIdentidade,
} from "@/lib/blog-endereco";
import { autorGravado } from "@/lib/autor";
import { PageviewTracker } from "./pageview-tracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; slug: string }>;
}): Promise<Metadata> {
  const { domain, slug } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) return {};

  const admin = createAdminClient();
  const { data: article } = await admin
    .from("articles")
    .select("id, title, seo_title, seo_description, excerpt, cover_image_url, published_at, updated_at")
    .eq("blog_id", blog.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) return {};

  const title = article.seo_title || article.title;
  const description = article.seo_description || article.excerpt || undefined;
  // Capa própria se o cliente subiu uma; senão a gerada com a cor da marca.
  // Absoluta e no app: a capa não vive sob o caminho do tenant, nem no
  // servidor do cliente quando o blog está numa pasta do site dele.
  const image =
    article.cover_image_url ||
    `${origemDoApp()}/api/og/${article.id}?v=${versaoDaIdentidade(blog)}`;

  return {
    metadataBase: new URL(urlPublicaDoBlog(blog).url),
    title,
    description,
    // Evita conteúdo duplicado quando o mesmo artigo é servido pelo
    // caminho /b/ e pelo domínio próprio - e nunca aponta para um host não
    // confirmado (mesma precedência do painel).
    alternates: { canonical: urlDoArtigo(blog, slug) },
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at ?? undefined,
      authors: autorGravado(blog.autor)?.nome ? [autorGravado(blog.autor)!.nome] : undefined,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function TenantArticlePage({
  params,
}: {
  params: Promise<{ domain: string; slug: string }>;
}) {
  const { domain, slug } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) notFound();

  const admin = createAdminClient();
  const { data: article } = await admin
    .from("articles")
    .select("*")
    .eq("blog_id", blog.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) notFound();

  const origin = urlPublicaDoBlog(blog).url;
  const app = origemDoApp();
  const autor = autorGravado(blog.autor);
  const site = siteDoCliente(blog);
  // Dado estruturado: habilita rich results no Google e dá à IA um
  // resumo inequívoco de autor, data e tema do artigo.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seo_description || article.excerpt || undefined,
    image: article.cover_image_url || `${app}/api/og/${article.id}?v=${versaoDaIdentidade(blog)}`,
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    mainEntityOfPage: `${origin}/${article.slug}`,
    // Autor com nome, cargo e perfil é o sinal de confiança que o Google e
    // as IAs mais pesam. Sem autor cadastrado, quem assina é a empresa - o
    // Google aceita Organization como autor, e é melhor que campo vazio.
    author: autor
      ? {
          "@type": "Person",
          name: autor.nome,
          jobTitle: autor.cargo ?? undefined,
          description: autor.bio ?? undefined,
          sameAs: autor.perfil ? [autor.perfil] : undefined,
          worksFor: { "@type": "Organization", name: blog.name },
        }
      : { "@type": "Organization", name: blog.name, url: site ?? origin },
    publisher: {
      "@type": "Organization",
      name: blog.name,
      // O site da empresa, não o blog: é a entidade que publica.
      url: site ?? origin,
      logo: blog.theme.logo_url
        ? { "@type": "ImageObject", url: blog.theme.logo_url }
        : undefined,
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonParaScript(jsonLd) }}
      />
      <PageviewTracker blogId={blog.id} articleId={article.id} rastreio={`${app}/api/track`} />
      <ArticleView blog={blog} article={article} inicio={await tenantOrigin(domain)} />
    </div>
  );
}
