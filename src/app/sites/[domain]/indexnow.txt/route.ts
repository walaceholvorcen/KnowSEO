import { resolveBlogByHost } from "@/lib/tenant";
import { chaveIndexNow } from "@/lib/indexnow";

// A prova de posse que o Bing confere antes de aceitar um aviso de
// publicação (ver src/lib/indexnow.ts): o arquivo responde a chave do blog.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) return new Response("Not found", { status: 404 });

  return new Response(chaveIndexNow(blog.id), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
