import Link from "next/link";
import Image from "next/image";
import { textoSobre } from "@/lib/contrast";
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
}: {
  blog: Blog;
  article: Pick<
    Article,
    "id" | "title" | "content_html" | "cover_image_url"
  >;
  /** Dentro do editor: nada de contar visita nem clique como se fosse real. */
  preview?: boolean;
}) {
  const corTexto = textoSobre(blog.theme.primary_color);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header
        className="px-6 py-10"
        style={{ backgroundColor: blog.theme.primary_color, color: corTexto }}
      >
        <div className="mx-auto max-w-2xl">
          <Link href="/" className="text-sm opacity-80 hover:opacity-100">
            ← {blog.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1
          data-preview="titulo"
          className="text-3xl font-bold text-slate-900 dark:text-slate-100"
        >
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
          data-preview="corpo"
          className="prose dark:prose-invert prose-slate mt-8 max-w-none [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-cobalto-600 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: article.content_html ?? "" }}
        />

        <CtaBanner blog={blog} articleId={article.id} preview={preview} />
      </main>
    </div>
  );
}
