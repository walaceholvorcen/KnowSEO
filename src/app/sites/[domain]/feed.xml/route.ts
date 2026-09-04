import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBlogByHost, tenantOrigin } from "@/lib/tenant";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Feed RSS do blog do cliente - canal de distribuição gratuito
// (agregadores, newsletters, automações tipo Zapier/Make).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) return new Response("Not found", { status: 404 });

  const origin = await tenantOrigin(domain);
  const admin = createAdminClient();

  const { data: articles } = await admin
    .from("articles")
    .select("title, slug, excerpt, published_at")
    .eq("blog_id", blog.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  const items = (articles ?? [])
    .map(
      (a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${origin}/${a.slug}</link>
      <guid>${origin}/${a.slug}</guid>${
        a.excerpt
          ? `
      <description>${escapeXml(a.excerpt)}</description>`
          : ""
      }${
        a.published_at
          ? `
      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>`
          : ""
      }
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(blog.name)}</title>
    <link>${origin}</link>
    <description>${escapeXml(blog.theme.tagline ?? blog.name)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
