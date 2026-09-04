"use client";

import { useEffect } from "react";

// Sem cookies, sem GA - um hash simples salvo em localStorage identifica
// um visitante entre páginas só o suficiente para não inflar métricas de
// forma grosseira. Substitua por algo mais robusto quando o volume exigir.
function getVisitorId(): string {
  const key = "content_os_vid";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function PageviewTracker({
  blogId,
  articleId,
}: {
  blogId: string;
  articleId: string;
}) {
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blogId,
        articleId,
        eventType: "pageview",
        path: window.location.pathname,
        visitorId: getVisitorId(),
      }),
      keepalive: true,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
