import { resolveBlogByHost, tenantOrigin } from "@/lib/tenant";

// robots.txt por tenant, apontando para o sitemap e para o llms.txt.
// Os crawlers de IA (GPTBot, ClaudeBot, PerplexityBot) são liberados de
// propósito: queremos que o conteúdo do cliente SEJA citado por elas -
// é exatamente a proposta de GEO do produto.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) return new Response("Not found", { status: 404 });

  const origin = tenantOrigin(domain);

  const body = `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml

# Guia para modelos de linguagem
# ${origin}/llms.txt
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
