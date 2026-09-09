import { ImageResponse } from "next/og";
import { textoSobre } from "@/lib/contrast";
import { createAdminClient } from "@/lib/supabase/admin";

// 1080x1350 (proporção 4:5): o formato que ocupa mais espaço no feed do
// Instagram hoje, tanto em post único quanto em carrossel.
const LARGURA = 1080;
const ALTURA = 1350;

// Mesmo motor da capa do artigo (/api/og) - Satori renderiza HTML/CSS em
// imagem na hora, sem gerar arquivo, sem custo de IA por imagem. Pública
// (sem checar sessão) de propósito: precisa ser um link direto para o
// cliente baixar ou colar no Instagram, igual à capa.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ articleId: string; slide: string }> },
) {
  const { articleId, slide } = await params;
  const indice = Number(slide) - 1;

  const admin = createAdminClient();
  const { data: article } = await admin
    .from("articles")
    .select("carousel_slides, blogs(name, theme)")
    .eq("id", articleId)
    .maybeSingle();

  const slides = (article?.carousel_slides ?? []) as {
    headline: string;
    body?: string;
  }[];
  const atual = slides[indice];

  if (!atual) {
    return new Response("slide not found", { status: 404 });
  }

  const blog = article?.blogs as
    | { name: string; theme: { primary_color: string } }
    | undefined;
  const color = blog?.theme?.primary_color ?? "#15191c";
  const tinta = textoSobre(color);
  const ehPrimeiro = indice === 0;
  const ehUltimo = indice === slides.length - 1;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: color,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: tinta, opacity: 0.75, fontWeight: 600 }}>
          {blog?.name ?? ""}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: ehPrimeiro ? 76 : 64,
              lineHeight: 1.15,
              color: tinta,
              fontWeight: 700,
            }}
          >
            {atual.headline}
          </div>
          {atual.body && (
            <div style={{ display: "flex", fontSize: 34, lineHeight: 1.4, color: tinta, opacity: 0.85 }}>
              {atual.body}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            width: "120px",
            height: "8px",
            borderRadius: "4px",
            background: tinta,
            opacity: ehUltimo ? 0 : 0.9,
          }}
        />
      </div>
    ),
    { width: LARGURA, height: ALTURA },
  );
}
