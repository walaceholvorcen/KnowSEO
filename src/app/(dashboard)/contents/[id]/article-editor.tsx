"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bold,
  Italic,
  List,
  Heading2,
  Link as LinkIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import type { Article } from "@/types";

export function ArticleEditor({ article }: { article: Article }) {
  const router = useRouter();
  const supabase = createClient();
  const contentRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState(article.title);
  const [seoTitle, setSeoTitle] = useState(article.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(
    article.seo_description ?? "",
  );
  const [status, setStatus] = useState(article.status);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isGenerating = article.generation_status === "generating";

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    contentRef.current?.focus();
  }

  async function handleSave(nextStatus?: Article["status"]) {
    setSaving(true);
    const finalStatus = nextStatus ?? status;

    const { error } = await supabase
      .from("articles")
      .update({
        title,
        slug: slugify(title),
        seo_title: seoTitle,
        seo_description: seoDescription,
        content_html: contentRef.current?.innerHTML ?? article.content_html,
        status: finalStatus,
        published_at:
          finalStatus === "published"
            ? new Date().toISOString()
            : article.published_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    setSaving(false);
    if (!error) {
      setStatus(finalStatus);
      setSavedAt(new Date().toLocaleTimeString("es-ES"));

      if (finalStatus === "published") {
        await fetch("/api/onboarding/complete-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "first_article_published" }),
        });
        router.refresh();
      }
    }
  }

  if (isGenerating) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-8 py-24 text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-navy-600 dark:border-navy-400 border-t-transparent" />
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Generando el artículo con IA...
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Esto puede tardar 20-40 segundos. Puedes salir y volver luego.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/contents"
          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> Voltar
        </Link>

        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Guardado {savedAt}
            </span>
          )}
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => handleSave("published")}
            disabled={saving}
            className="rounded-lg bg-navy-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {status === "published" ? "Actualizar" : "Publicar"}
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="w-full border-none text-3xl font-bold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-300"
      />

      <div className="mt-6 flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5">
        <button
          onClick={() => exec("bold")}
          className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
          type="button"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => exec("italic")}
          className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
          type="button"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => exec("formatBlock", "h2")}
          className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
          type="button"
        >
          <Heading2 size={16} />
        </button>
        <button
          onClick={() => exec("insertUnorderedList")}
          className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
          type="button"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => {
            const url = window.prompt("URL del enlace");
            if (url) exec("createLink", url);
          }}
          className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
          type="button"
        >
          <LinkIcon size={16} />
        </button>
      </div>

      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: article.content_html ?? "" }}
        className="prose dark:prose-invert prose-slate mt-4 min-h-[400px] max-w-none rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 outline-none focus:border-navy-400 dark:focus:border-navy-300 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-navy-600 [&_a]:underline"
      />

      <div className="mt-8 space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">SEO</h3>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Meta título ({seoTitle.length}/60)
          </label>
          <input
            value={seoTitle}
            maxLength={60}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-navy-500 dark:focus:border-navy-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Meta descripción ({seoDescription.length}/155)
          </label>
          <textarea
            value={seoDescription}
            maxLength={155}
            onChange={(e) => setSeoDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-navy-500 dark:focus:border-navy-400"
          />
        </div>
      </div>
    </div>
  );
}
