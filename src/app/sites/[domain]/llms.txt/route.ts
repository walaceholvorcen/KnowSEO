import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBlogByHost, tenantOrigin } from "@/lib/tenant";

// llms.txt - índice em markdown pensado para modelos de linguagem
// (ChatGPT, Claude, Perplexity) entenderem rapidamente o que o negócio do
// cliente faz e qual conteúdo ele tem. É a primeira peça concreta do
// diferencial de GEO: a condição para ser CITADO por uma IA é ela
// conseguir entender e recuperar o conteúdo com pouco esforço.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) return new Response("Not found", { status: 404 });

  const origin = tenantOrigin(domain);
  const admin = createAdminClient();

  const [{ data: dna }, { data: articles }] = await Promise.all([
    admin
      .from("brand_dna")
      .select("description, target_audience")
      .eq("blog_id", blog.id)
      .maybeSingle(),
    admin
      .from("articles")
      .select("title, slug, excerpt, published_at")
      .eq("blog_id", blog.id)
      .eq("status", "published")
      .order("published_at", { ascending: false }),
  ]);

  const lines: string[] = [`# ${blog.name}`, ""];

  if (blog.theme.tagline) lines.push(`> ${blog.theme.tagline}`, "");
  if (dna?.description) lines.push(dna.description, "");
  if (dna?.target_audience)
    lines.push(`Público objetivo: ${dna.target_audience}`, "");

  lines.push("## Artículos", "");

  if (!articles?.length) {
    lines.push("_Todavía no hay artículos publicados._");
  } else {
    for (const a of articles) {
      const desc = a.excerpt ? `: ${a.excerpt}` : "";
      lines.push(`- [${a.title}](${origin}/${a.slug})${desc}`);
    }
  }

  lines.push("", "## Recursos", "", `- [Sitemap](${origin}/sitemap.xml)`);

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
