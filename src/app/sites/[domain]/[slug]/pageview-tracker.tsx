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
  rastreio,
}: {
  blogId: string;
  articleId: string;
  /** Endereço completo de /api/track no app. Relativo, no blog servido de
   *  dentro do site do cliente, iria parar no servidor dele. */
  rastreio: string;
}) {
  useEffect(() => {
    // no-cors e sem Content-Type: com o blog numa pasta do site do cliente o
    // pedido é para outra origem, e um JSON declarado dispararia uma
    // pré-checagem que a rota não responde. Assim o corpo vai como texto e
    // a rota lê do mesmo jeito. Não precisamos ler a resposta.
    fetch(rastreio, {
      method: "POST",
      mode: "no-cors",
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
