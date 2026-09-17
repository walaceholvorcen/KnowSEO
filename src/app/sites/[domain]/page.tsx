import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBlogByHost, tenantOrigin } from "@/lib/tenant";
import { textoSobre } from "@/lib/contrast";
import { urlPublicaDoBlog, versaoDaIdentidade } from "@/lib/blog-endereco";
import { formatarData, fusoDoPais } from "@/lib/datas";
import { paisDoBlog } from "@/lib/keywords/metricas";
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

  // Canonical pela mesma precedência do painel: o blog aberto por um host
  // não confirmado aponta para o endereço que de fato está no ar.
  const publica = urlPublicaDoBlog(blog).url;
  return {
    metadataBase: new URL(publica),
    alternates: { canonical: publica },
    // Marca de fábrica, e é ela que a checagem de domínio procura para saber
    // se quem responde naquele endereço é o blog ou a página antiga do site.
    generator: "Know SEO",
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
  // Link relativo "/slug" em /b/<slug> caía na raiz do app (404): a base
  // precisa do caminho do tenant, e do host em que o visitante está.
  const base = await tenantOrigin(domain);
  // Quem lê o blog é o mercado do cliente, não quem opera o painel: a data
  // sai no fuso do país do domínio (dataknow.es → Madri). Sem domínio de
  // país, UTC - o cookie do operador nem chega a este visitante.
  const fuso = fusoDoPais(
    paisDoBlog({ dominio: blog.custom_domain, idioma: blog.language }),
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header
        className="px-6 py-16 text-center"
        style={{
          backgroundColor: blog.theme.primary_color,
          color: textoSobre(blog.theme.primary_color),
        }}
      >
        {/* O logo substitui o nome escrito: quem tem marca desenhada quer
            ver a marca, e o nome continua no título da página e no JSON-LD. */}
        {blog.theme.logo_url ? (
          <Image
            src={blog.theme.logo_url}
            alt={blog.name}
            width={280}
            height={80}
            unoptimized
            className="mx-auto max-h-16 w-auto object-contain"
          />
        ) : (
          <h1 className="text-3xl font-bold">{blog.name}</h1>
        )}
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
                href={`${base}/${article.slug}`}
                className="block border-b border-slate-100 dark:border-slate-800 pb-8"
              >
                {/* unoptimized: a capa já sai pronta da nossa rota /api/og, o
                    otimizador não tem o que ganhar - e no Next 16 ele recusa
                    imagem local com "?v=" na URL (a versão que fura o cache
                    quando a identidade muda), deixando o card sem imagem. */}
                <Image
                  unoptimized
                  src={article.cover_image_url || `/api/og/${article.id}?v=${versaoDaIdentidade(blog)}`}
                  alt={article.title}
                  width={1200}
                  height={630}
                  className="mb-4 w-full rounded-xl"
                />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 hover:text-cobalto-600 dark:hover:text-cobalto-300">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{article.excerpt}</p>
                )}
                {article.published_at && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {formatarData(article.published_at!, fuso, "longa")}
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
