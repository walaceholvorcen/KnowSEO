"use client";

import type { Blog } from "@/types";

export function CtaBanner({
  blog,
  articleId,
}: {
  blog: Blog;
  articleId: string;
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
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blogId: blog.id,
        articleId,
        eventType: cta.type === "whatsapp" ? "whatsapp_click" : "cta_click",
        path: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <div
      className="mt-12 rounded-xl p-6 text-center text-white"
      style={{ backgroundColor: blog.theme.primary_color }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="inline-block rounded-lg bg-white dark:bg-slate-900 px-6 py-2.5 font-semibold"
        style={{ color: blog.theme.primary_color }}
      >
        {cta.button_text}
      </a>
    </div>
  );
}
