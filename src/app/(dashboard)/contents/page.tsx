import Link from "next/link";
import Image from "next/image";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { formatDate } from "@/lib/utils";
import type { Article } from "@/types";

const STATUS_LABEL: Record<Article["status"], string> = {
  draft: "Borrador",
  scheduled: "Programado",
  published: "Publicado",
};

const STATUS_COLOR: Record<Article["status"], string> = {
  draft: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  scheduled: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  published: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
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

  const list = (articles as Article[]) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Conteúdos</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Crie, revise e publique os artigos do seu blog.
          </p>
        </div>
        <Link
          href="/strategy"
          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-700"
        >
          + Criar conteúdo
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">
            Nenhum artigo ainda.{" "}
            <Link href="/strategy" className="text-navy-600 dark:text-navy-300 underline">
              Escolha uma keyword
            </Link>{" "}
            para gerar o primeiro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((article) => (
            <Link
              key={article.id}
              href={`/contents/${article.id}`}
              className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition hover:border-navy-300 dark:hover:border-navy-600 hover:shadow-sm"
            >
              <Image
                src={article.cover_image_url || `/api/og/${article.id}`}
                alt={article.title}
                width={1200}
                height={630}
                className="w-full"
              />
              <div className="p-4">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[article.status]}`}
                >
                  {STATUS_LABEL[article.status]}
                </span>
                <h3 className="mt-2 line-clamp-2 font-semibold text-slate-900 dark:text-slate-100">
                  {article.title}
                </h3>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  {formatDate(article.created_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
