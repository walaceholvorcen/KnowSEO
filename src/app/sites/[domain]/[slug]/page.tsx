import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveBlogByHost,
  tenantBaseUrl,
  tenantOrigin,
  tenantAssetOrigin,
} from "@/lib/tenant";
import { CtaBanner } from "./cta-banner";
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
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageviewTracker blogId={blog.id} articleId={article.id} />

      <header
        className="px-6 py-10 text-white"
        style={{ backgroundColor: blog.theme.primary_color }}
      >
        <div className="mx-auto max-w-2xl">
          <Link href="/" className="text-sm opacity-80 hover:opacity-100">
            ← {blog.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          {article.title}
        </h1>

        <Image
          src={article.cover_image_url || `/api/og/${article.id}`}
          alt={article.title}
          width={1200}
          height={630}
          priority
          className="mt-6 w-full rounded-xl"
        />

        <article
          className="prose dark:prose-invert prose-slate mt-8 max-w-none [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-navy-600 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: article.content_html ?? "" }}
        />

        <CtaBanner blog={blog} articleId={article.id} />
      </main>
    </div>
  );
}
