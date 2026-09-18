import Link from "next/link";
import Image from "next/image";
import { textoSobre } from "@/lib/contrast";
import { origemDoApp, versaoDaIdentidade } from "@/lib/blog-endereco";
import { AssinaturaDoArtigo, LinkDoSite, RodapeDoBlog, SobreOAutor } from "@/components/blog-publico";
import { htmlSeguro } from "@/lib/html-seguro";
import { CtaBanner } from "@/app/sites/[domain]/[slug]/cta-banner";
import type { Article, Blog } from "@/types";

// A página do artigo, usada em dois lugares: no blog público do cliente e
// dentro do editor, como pré-visualização.
//
// É o mesmo componente de propósito. Uma pré-visualização montada à parte
// vira uma réplica que envelhece: muda a cor da marca, o CTA ou o espaçamento
// no blog e a prévia continua mostrando o desenho antigo - ou seja, mente
// justamente na hora em que o cliente decide publicar.
export function ArticleView({
  blog,
  article,
  preview = false,
  inicio = "/",
}: {
  blog: Blog;
  article: Pick<
    Article,
    "id" | "title" | "content_html" | "cover_image_url" | "published_at" | "updated_at"
  >;
  /** Dentro do editor: nada de contar visita nem clique como se fosse real. */
  preview?: boolean;
  /** Home do blog no host atual: em /b/<slug>, "/" levaria à raiz do app. */
  inicio?: string;
}) {
  const corTexto = textoSobre(blog.theme.primary_color);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header
        className="px-6 py-10"
        style={{ backgroundColor: blog.theme.primary_color, color: corTexto }}
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <Link href={inicio} className="text-sm opacity-80 hover:opacity-100">
            ← {blog.name}
          </Link>
          <LinkDoSite blog={blog} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1
          data-preview="titulo"
          className="text-3xl font-bold text-slate-900 dark:text-slate-100"
        >
          {article.title}
        </h1>
        <AssinaturaDoArtigo
          blog={blog}
          publicadoEm={article.published_at}
          atualizadoEm={article.updated_at}
        />

        {/* unoptimized: a capa já sai pronta da nossa rota /api/og, o
                    otimizador não tem o que ganhar - e no Next 16 ele recusa
                    imagem local com "?v=" na URL (a versão que fura o cache
                    quando a identidade muda), deixando o card sem imagem. */}
                <Image
                  unoptimized
          src={article.cover_image_url || `${origemDoApp()}/api/og/${article.id}?v=${versaoDaIdentidade(blog)}`}
          alt={article.title}
          width={1200}
          height={630}
          priority
          className="mt-6 w-full rounded-xl"
        />

        <article
          data-preview="corpo"
          className="prose dark:prose-invert prose-slate mt-8 max-w-none [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-cobalto-600 [&_a]:underline"
          // Limpo também na leitura: artigo gravado antes da trava de 17/09
          // não passou por htmlSeguro ao ser salvo.
          dangerouslySetInnerHTML={{ __html: htmlSeguro(article.content_html) }}
        />

        <SobreOAutor blog={blog} />

        {/* Só o que o banner usa: prop de componente client vai inteira para o
            payload RSC do HTML público, e o objeto blog carrega workspace_id,
            slugs antigos, domínios da marca e domínio ainda não verificado. */}
        <CtaBanner
          blog={{ id: blog.id, cta_config: blog.cta_config, theme: blog.theme }}
          articleId={article.id}
          rastreio={`${origemDoApp()}/api/track`}
          preview={preview}
        />
      </main>

      <RodapeDoBlog blog={blog} largura="max-w-2xl" />
    </div>
  );
}
