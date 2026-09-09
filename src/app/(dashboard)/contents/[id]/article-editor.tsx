"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bold,
  Italic,
  List,
  Heading2,
  Link as LinkIcon,
  Monitor,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Article } from "@/types";

// Largura lógica de cada aparelho. A prévia é renderizada nessa largura e
// depois reduzida por escala - mostrar uma página de desktop espremida em
// 600px daria uma leitura falsa do resultado.
const LARGURA = { desktop: 1180, mobile: 390 };

export function ArticleEditor({
  article,
  enderecoPublico,
}: {
  article: Article;
  /** Endereço do artigo no blog do cliente, mostrado acima da prévia. */
  enderecoPublico: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const contentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const molduraRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState(article.title);
  const [seoTitle, setSeoTitle] = useState(article.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(
    article.seo_description ?? "",
  );
  const [slug, setSlug] = useState(article.slug);
  const [status, setStatus] = useState(article.status);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aparelho, setAparelho] = useState<"desktop" | "mobile">("desktop");
  const [escala, setEscala] = useState(1);

  const isGenerating = article.generation_status === "generating";

  // Manda o conteúdo atual para a prévia. Chamado na pausa da digitação e
  // quando o iframe avisa que terminou de montar.
  function enviarParaPrevia() {
    iframeRef.current?.contentWindow?.postMessage(
      {
        tipo: "knowseo:preview",
        titulo: title,
        corpo: contentRef.current?.innerHTML ?? "",
      },
      window.location.origin,
    );
  }

  // A prévia avisa quando montou; sem isso o primeiro envio se perde no ar
  // e o cliente vê o texto salvo, não o que acabou de escrever.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.tipo === "knowseo:preview-pronta") enviarParaPrevia();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  // Espera a pausa na digitação: mandar a cada tecla trava a escrita em
  // artigo longo, e ninguém lê a prévia enquanto digita mesmo.
  useEffect(() => {
    const id = setTimeout(enviarParaPrevia, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // Reduz a prévia até caber na coluna, sem cortar nada.
  useEffect(() => {
    const moldura = molduraRef.current;
    if (!moldura) return;

    const ajustar = () =>
      setEscala(
        Math.min(1, moldura.clientWidth / LARGURA[aparelho]),
      );

    ajustar();
    const observer = new ResizeObserver(ajustar);
    observer.observe(moldura);
    return () => observer.disconnect();
  }, [aparelho]);

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    contentRef.current?.focus();
  }

  async function handleSave(nextStatus?: Article["status"]) {
    setSaving(true);
    setError(null);
    const finalStatus = nextStatus ?? status;

    // O slug vem do campo, não do título.
    //
    // Antes ele era recalculado do título a cada salvamento. Isso descartava
    // o slug curto que o modelo escolhe e, pior, trocava a URL de um artigo
    // já publicado assim que alguém ajustasse o título - todo link que
    // apontava para ele passava a dar 404, num produto de SEO.
    const slugFinal = slugify(slug) || slugify(title);

    const { error: saveError } = await supabase
      .from("articles")
      .update({
        title,
        slug: slugFinal,
        seo_title: seoTitle,
        seo_description: seoDescription,
        content_html: contentRef.current?.innerHTML ?? article.content_html,
        status: finalStatus,
        // Só a primeira publicação define a data. Sem isto, cada correção
        // num artigo publicado o devolvia ao topo do blog como se fosse novo.
        published_at:
          finalStatus === "published"
            ? (article.published_at ?? new Date().toISOString())
            : article.published_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    setSaving(false);

    // O erro era descartado: slug repetido derrubava o salvamento e a tela
    // não dizia nada - o cliente saía achando que tinha publicado.
    if (saveError) {
      setError(
        saveError.code === "23505"
          ? "Já existe outro artigo com esse endereço. Mude o endereço do artigo."
          : saveError.message,
      );
      return;
    }

    setSlug(slugFinal);
    setStatus(finalStatus);
    setSavedAt(new Date().toLocaleTimeString("pt-BR"));

    if (finalStatus === "published") {
      await fetch("/api/onboarding/complete-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "first_article_published" }),
      });
      router.refresh();
    }
  }

  if (isGenerating) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-8 py-24 text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cobalto-600 dark:border-cobalto-400 border-t-transparent" />
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Gerando o artigo com IA...
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Pode levar de 20 a 40 segundos. Você pode sair e voltar depois.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-3">
        <Link
          href="/contents"
          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> Voltar
        </Link>

        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-sm text-slate-400 dark:text-slate-500">
              Salvo {savedAt}
            </span>
          )}
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Salvar rascunho
          </button>
          <button
            onClick={() => handleSave("published")}
            disabled={saving}
            className="rounded-lg bg-cobalto-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
          >
            {status === "published" ? "Atualizar" : "Publicar"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Escrita */}
        <div className="min-w-0 flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto max-w-2xl">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título"
              className="w-full border-none bg-transparent text-3xl font-bold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-300"
            />

            <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <span>/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="endereco-do-artigo"
                className="min-w-0 flex-1 border-none bg-transparent outline-none focus:text-slate-900 dark:focus:text-slate-100"
              />
            </div>
            {status === "published" && slug !== article.slug && (
              <p className="mt-1 text-sm text-nota-atencao">
                Mudar o endereço de um artigo publicado quebra os links que já
                apontam para ele. O endereço atual é /{article.slug}.
              </p>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm text-nota-critico">
                {error}
              </p>
            )}

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
                  const url = window.prompt("URL do link");
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
              onInput={() => {
                // Direto no evento, sem estado intermediário: guardar o HTML
                // do corpo em useState a cada tecla faz o cursor pular.
                clearTimeout(
                  (window as unknown as { __previa?: number }).__previa,
                );
                (window as unknown as { __previa?: number }).__previa =
                  window.setTimeout(enviarParaPrevia, 400);
              }}
              dangerouslySetInnerHTML={{ __html: article.content_html ?? "" }}
              className="prose dark:prose-invert prose-slate mt-4 min-h-[400px] max-w-none rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 outline-none focus:border-cobalto-400 dark:focus:border-cobalto-300 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-cobalto-600 [&_a]:underline"
            />

            <div className="mt-8 space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="font-medium text-slate-900 dark:text-slate-100">
                Como aparece no Google
              </h3>
              <div>
                <label className="mb-1 block text-sm text-slate-500 dark:text-slate-400">
                  Título da busca ({seoTitle.length}/60)
                </label>
                <input
                  value={seoTitle}
                  maxLength={60}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-500 dark:text-slate-400">
                  Descrição da busca ({seoDescription.length}/155)
                </label>
                <textarea
                  value={seoDescription}
                  maxLength={155}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Prévia */}
        <div className="hidden w-[46%] shrink-0 flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 lg:flex">
          <div className="flex shrink-0 items-center gap-3 px-5 py-3">
            <p className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
              {enderecoPublico}
            </p>

            <div className="flex items-center gap-0.5 rounded-lg border border-slate-300 dark:border-slate-700 p-0.5">
              {(["desktop", "mobile"] as const).map((tipo) => {
                const Icone = tipo === "desktop" ? Monitor : Smartphone;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setAparelho(tipo)}
                    aria-label={
                      tipo === "desktop" ? "Ver em computador" : "Ver em celular"
                    }
                    aria-pressed={aparelho === tipo}
                    className={cn(
                      "rounded-md p-1.5",
                      aparelho === tipo
                        ? "bg-cobalto-600 text-white"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800",
                    )}
                  >
                    <Icone size={15} />
                  </button>
                );
              })}
            </div>

            {status === "published" && (
              <a
                href={enderecoPublico}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-cobalto-600 dark:text-cobalto-400 hover:underline"
              >
                Abrir <ExternalLink size={13} />
              </a>
            )}
          </div>

          <div
            ref={molduraRef}
            className="min-h-0 flex-1 overflow-hidden px-5 pb-5"
          >
            <div className="h-full overflow-hidden rounded-xl border border-slate-300 dark:border-slate-800 bg-white">
              <iframe
                ref={iframeRef}
                src={`/preview/${article.id}`}
                title="Prévia do artigo publicado"
                className="origin-top-left border-0"
                style={{
                  width: LARGURA[aparelho],
                  height: `${100 / escala}%`,
                  transform: `scale(${escala})`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
