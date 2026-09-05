import Link from "next/link";
import Image from "next/image";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { formatDate } from "@/lib/utils";
import { Lede } from "@/components/lede";
import type { Article } from "@/types";

const STATUS_LABEL: Record<Article["status"], string> = {
  draft: "Rascunho",
  scheduled: "Programado",
  published: "Publicado",
};

// O estado vira cor de texto, não pílula com fundo próprio: com uma pílula
// colorida por card a grade virava confete e o que se via era a cor, não o
// artigo.
const STATUS_COLOR: Record<Article["status"], string> = {
  draft: "text-slate-500 dark:text-slate-400",
  scheduled: "text-nota-atencao",
  published: "text-nota-excelente",
};

export default async function ContentsPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false });

  const lista = (articles as Article[]) ?? [];
  const publicados = lista.filter((a) => a.status === "published").length;
  const rascunhos = lista.length - publicados;

  const veredito =
    lista.length === 0
      ? "Nenhum artigo ainda. Escolha uma pauta e a IA escreve o primeiro."
      : rascunhos === 0
        ? `${publicados} ${publicados === 1 ? "artigo publicado" : "artigos publicados"}.`
        : `${publicados} no ar, ${rascunhos} ${rascunhos === 1 ? "esperando revisão" : "esperando revisão"}.`;

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <Lede
        acao={
          <Link
            href="/strategy"
            className="rounded-lg bg-cobalto-600 px-4 py-2 font-semibold text-white hover:bg-cobalto-700"
          >
            Escrever novo artigo
          </Link>
        }
      >
        {veredito}
      </Lede>

      {lista.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((article) => (
            <Link
              key={article.id}
              href={`/contents/${article.id}`}
              className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition hover:border-cobalto-400 dark:hover:border-cobalto-500"
            >
              <Image
                src={article.cover_image_url || `/api/og/${article.id}`}
                alt=""
                width={1200}
                height={630}
                className="w-full"
              />
              <div className="p-4">
                <h3 className="line-clamp-2 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cobalto-700 dark:group-hover:text-cobalto-300">
                  {article.title}
                </h3>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  <span className={STATUS_COLOR[article.status]}>
                    {STATUS_LABEL[article.status]}
                  </span>
                  {" · "}
                  {formatDate(article.published_at ?? article.created_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
