import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveBlogByHost,
  tenantBaseUrl,
  tenantOrigin,
  tenantAssetOrigin,
} from "@/lib/tenant";
import { ArticleView } from "@/components/article-view";
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
    .select("id, title, seo_title, seo_description, excerpt, cover_image_url")
    .eq("blog_id", blog.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) return {};

  const title = article.seo_title || article.title;
  const description = article.seo_description || article.excerpt || undefined;
  // Capa própria se o cliente subiu uma; senão a gerada com a cor da marca.
  // Absoluta e a partir da raiz do app: a capa não vive sob o caminho
  // do tenant.
  const image =
    article.cover_image_url ||
    `${await tenantAssetOrigin(domain)}/api/og/${article.id}`;

  return {
    metadataBase: await tenantBaseUrl(domain),
    title,
    description,
    // Evita conteúdo duplicado quando o mesmo artigo é servido pelo
    // subdomínio e pelo domínio próprio do cliente.
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title,
      description,
      type: "article",
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

  const origin = await tenantOrigin(domain);
  const assetOrigin = await tenantAssetOrigin(domain);
  // Dado estruturado: habilita rich results no Google e dá à IA um
  // resumo inequívoco de autor, data e tema do artigo.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seo_description || article.excerpt || undefined,
    image: article.cover_image_url || `${assetOrigin}/api/og/${article.id}`,
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    mainEntityOfPage: `${origin}/${article.slug}`,
    publisher: {
      "@type": "Organization",
      name: blog.name,
      url: origin,
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageviewTracker blogId={blog.id} articleId={article.id} />
      <ArticleView blog={blog} article={article} />
    </div>
  );
}
