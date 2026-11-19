import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventType } from "@/types";
import { origemDaVisita } from "@/lib/ia-trafego";

// Endpoint público (chamado pelo script embutido nas páginas do blog do
// tenant). Usa o client com service_role porque o visitante é anônimo -
// não tem sessão Supabase. É o motor do nosso "Relatórios nativo": não
// depende do cliente conectar Google Analytics para termos dado desde o
// primeiro artigo publicado.
const DO_NAVEGADOR: EventType[] = ["pageview", "cta_click", "whatsapp_click"];

function hostDe(endereco: string | null): string | null {
  try {
    return endereco ? new URL(endereco).hostname : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { blogId, articleId, eventType, path, visitorId, origem, marcacao } = body as {
    blogId?: string;
    articleId?: string | null;
    eventType?: EventType;
    path?: string;
    visitorId?: string;
    origem?: unknown;
    marcacao?: unknown;
  };

  if (!blogId || !eventType) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  // "ai_bot" só o servidor grava, lendo o cabeçalho do robô de verdade
  // (lib/ia-registro). Esta rota é pública: aceitá-lo daqui deixaria
  // qualquer um fabricar "o Claude leu seu artigo" com um pedido.
  if (!DO_NAVEGADOR.includes(eventType)) {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }

  const supabase = createAdminClient();

  await supabase.from("analytics_events").insert({
    blog_id: blogId,
    article_id: articleId ?? null,
    event_type: eventType,
    path: path ?? null,
    // De que site a visita chegou. O cabeçalho deste pedido é a própria
    // página do blog (é ela que chama o rastreio), então ele só serve para
    // saber qual é o blog e descartar navegação interna - gravá-lo, como se
    // fazia, enchia a coluna com o endereço do próprio artigo.
    referrer: origemDaVisita(origem, marcacao, hostDe(request.headers.get("referer"))),
    visitor_id: visitorId ?? null,
  });

  return NextResponse.json({ ok: true });
}
