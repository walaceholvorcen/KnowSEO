"use client";

import { textoSobre } from "@/lib/contrast";
import type { Blog } from "@/types";

export function CtaBanner({
  blog,
  articleId,
  rastreio,
  preview = false,
}: {
  // Só os campos usados: tudo o que chega aqui vai para o HTML público
  // (payload RSC). Quem chama deve montar o objeto, não repassar o blog.
  blog: Pick<Blog, "id" | "cta_config" | "theme">;
  articleId: string;
  /** Endereço completo de /api/track no app (ver PageviewTracker). */
  rastreio: string;
  /** Dentro do editor: o clique não pode virar conversa no relatório. */
  preview?: boolean;
}) {
  const { cta_config: cta } = blog;
  if (!cta.button_text || (!cta.button_url && !cta.whatsapp_number)) {
    return null;
  }

  const href =
    cta.type === "whatsapp" && cta.whatsapp_number
      ? `https://wa.me/${cta.whatsapp_number.replace(/\D/g, "")}`
      : (cta.button_url ?? "#");

  function handleClick() {
    if (preview) return;

    fetch(rastreio, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        blogId: blog.id,
        articleId,
        eventType: cta.type === "whatsapp" ? "whatsapp_click" : "cta_click",
        path: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  }

  // O botão era branco com texto na cor da marca. Marca clara = botão
  // branco sobre fundo claro, invisível. Agora o par sai da própria cor:
  // o fundo do botão é o oposto legível dela, e o texto volta a ser a cor
  // da marca - contraste garantido nos dois sentidos.
  const corTexto = textoSobre(blog.theme.primary_color);
  // Com cor secundária definida, o botão é ela - é para isso que a segunda
  // cor da marca serve. Sem ela, continua o par calculado da principal.
  const fundoBotao = blog.theme.secondary_color || corTexto;
  const tintaBotao = blog.theme.secondary_color
    ? textoSobre(blog.theme.secondary_color)
    : blog.theme.primary_color;

  return (
    <div
      className="mt-12 rounded-xl p-6 text-center"
      style={{
        backgroundColor: blog.theme.primary_color,
        color: corTexto,
      }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="inline-block rounded-lg px-6 py-2.5 font-semibold"
        style={{ backgroundColor: fundoBotao, color: tintaBotao }}
      >
        {cta.button_text}
      </a>
    </div>
  );
}
