import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBlogByHost, tenantBaseUrl } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import type { Article } from "@/types";

// Sem isto o blog do cliente herdaria o título do app ("Know SEO"), o que
// seria péssimo para o SEO e a marca dele.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) return {};

  return {
    metadataBase: tenantBaseUrl(domain),
    title: blog.name,
    description: blog.theme.tagline ?? undefined,
    openGraph: {
      title: blog.name,
      description: blog.theme.tagline ?? undefined,
      type: "website",
    },
  };
}

export default async function TenantBlogHome({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) notFound();

  const admin = createAdminClient();
  const { data: articles } = await admin
    .from("articles")
    .select("*")
    .eq("blog_id", blog.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const list = (articles as Article[]) ?? [];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header
        className="px-6 py-16 text-center text-white"
        style={{ backgroundColor: blog.theme.primary_color }}
      >
        <h1 className="text-3xl font-bold">{blog.name}</h1>
        {blog.theme.tagline && (
          <p className="mt-2 opacity-90">{blog.theme.tagline}</p>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {list.length === 0 ? (
          <p className="text-center text-slate-400 dark:text-slate-500">
            Todavía no hay artículos publicados.
          </p>
        ) : (
          <div className="space-y-8">
            {list.map((article) => (
              <Link
                key={article.id}
                href={`/${article.slug}`}
                className="block border-b border-slate-100 dark:border-slate-800 pb-8"
              >
                <Image
                  src={article.cover_image_url || `/api/og/${article.id}`}
                  alt={article.title}
                  width={1200}
                  height={630}
                  className="mb-4 w-full rounded-xl"
                />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 hover:text-navy-600 dark:hover:text-navy-300">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{article.excerpt}</p>
                )}
                {article.published_at && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {formatDate(article.published_at)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
