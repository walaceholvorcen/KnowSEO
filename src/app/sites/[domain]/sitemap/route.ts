import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBlogByHost, tenantOrigin } from "@/lib/tenant";

// A pasta se chama "sitemap" (e não "sitemap.xml") de propósito: o Next
// trata "sitemap.xml" como arquivo de metadata e normaliza a rota,
// trocando o [domain] por "-" - o que serviria o mesmo sitemap para
// todos os tenants. O caminho público /sitemap.xml é mapeado no proxy.
export const dynamic = "force-dynamic";

// Sitemap por tenant. Sem isto o Google descobre os artigos só por
// rastreamento passivo - o que atrasa em semanas a indexação e, na
// prática, atrasa o resultado que o cliente está pagando para ver.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) return new Response("Not found", { status: 404 });

  const origin = tenantOrigin(domain);
  const admin = createAdminClient();

  const { data: articles } = await admin
    .from("articles")
    .select("slug, published_at, updated_at")
    .eq("blog_id", blog.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const urls = [
    { loc: origin, lastmod: null, priority: "1.0" },
    ...(articles ?? []).map((a) => ({
      loc: `${origin}/${a.slug}`,
      lastmod: a.updated_at ?? a.published_at,
      priority: "0.8",
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${
      u.lastmod
        ? `
    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>`
        : ""
    }
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
