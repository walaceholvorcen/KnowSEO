import { cache } from "react";
import { unstable_cache } from "next/cache";
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
import { perguntasFrequentes } from "@/lib/artigo/faq";
import { autorGravado } from "@/lib/autor";
import { PageviewTracker } from "./pageview-tracker";

// O artigo, buscado uma vez só.
//
// Eram duas consultas por visita (uma para os metadados do cabeçalho, outra
// para o corpo) e as duas iam ao banco de novo a cada visitante. Agora é uma
// só, guardada por um minuto: o leitor do blog do cliente deixa de esperar
// o banco para ler um texto que já estava pronto. Um minuto também é o
// atraso máximo entre publicar e ver no ar.
const buscarArtigo = unstable_cache(
  async (blogId: string, slug: string) => {
    const { data } = await createAdminClient()
      .from("articles")
      .select("*")
      .eq("blog_id", blogId)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return data;
  },
  ["artigo-publicado"],
  { revalidate: 60 },
);

/** cache(): metadados e página pedem o mesmo artigo na mesma visita. */
const artigoPublicado = cache(buscarArtigo);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; slug: string }>;
}): Promise<Metadata> {
  const { domain, slug } = await params;
  const blog = await resolveBlogByHost(domain);
  if (!blog) return {};

  const article = await artigoPublicado(blog.id, slug);
  if (!article) return {};

  const title = article.seo_title || article.title;
  const description = article.seo_description || article.excerpt || undefined;
  // Capa própria se o cliente subiu uma; senão a gerada com a cor da marca.
  // Absoluta e no app: a capa não vive sob o caminho do tenant, nem no
  // servidor do cliente quando o blog está numa pasta do site dele.
  const image =
    article.cover_image_url ||
    `${origemDoApp()}/api/og/${article.id}?v=${versaoDaIdentidade(blog)}`;

  const publica = urlPublicaDoBlog(blog);

  return {
    metadataBase: new URL(publica.url),
    // Sem endereço do cliente, o artigo só existe no caminho da plataforma:
    // é prévia para a agência conferir, e fica fora do Google. Nada do
    // cliente é indexado embaixo do nosso domínio.
    robots: publica.kind === "path" ? { index: false, follow: false } : undefined,
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

  const article = await artigoPublicado(blog.id, slug);
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

  // Perguntas frequentes lidas do próprio texto (ver lib/artigo/faq.ts).
  // O Google só mostra FAQ como resultado rico para sites de governo e
  // saúde; o schema fica pelas IAs, que extraem pergunta e resposta prontas.
  const faq = perguntasFrequentes(article.content_html);
  const faqLd = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((p) => ({
          "@type": "Question",
          name: p.pergunta,
          acceptedAnswer: { "@type": "Answer", text: p.resposta },
        })),
      }
    : null;

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonParaScript(jsonLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonParaScript(faqLd) }}
        />
      )}
      <PageviewTracker blogId={blog.id} articleId={article.id} rastreio={`${app}/api/track`} />
      <ArticleView blog={blog} article={article} inicio={await tenantOrigin(domain)} />
    </div>
  );
}
