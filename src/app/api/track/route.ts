import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventType } from "@/types";

// Endpoint público (chamado pelo script embutido nas páginas do blog do
// tenant). Usa o client com service_role porque o visitante é anônimo -
// não tem sessão Supabase. É o motor do nosso "Relatórios nativo": não
// depende do cliente conectar Google Analytics para termos dado desde o
// primeiro artigo publicado.
export async function POST(request: Request) {
  const body = await request.json();
  const { blogId, articleId, eventType, path, visitorId } = body as {
    blogId?: string;
    articleId?: string | null;
    eventType?: EventType;
    path?: string;
    visitorId?: string;
  };

  if (!blogId || !eventType) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  await supabase.from("analytics_events").insert({
    blog_id: blogId,
    article_id: articleId ?? null,
    event_type: eventType,
    path: path ?? null,
    referrer: request.headers.get("referer"),
    visitor_id: visitorId ?? null,
  });

  return NextResponse.json({ ok: true });
}
