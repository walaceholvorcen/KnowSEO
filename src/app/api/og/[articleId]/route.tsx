import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

// Capa gerada na hora, com a cor da marca do cliente. Serve como imagem
// do artigo no blog E como preview quando alguém compartilha o link no
// WhatsApp/LinkedIn (Open Graph). Sem depender de banco de imagens nem
// de geração por IA - custo zero e sempre on-brand.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const { articleId } = await params;
  const admin = createAdminClient();

  const { data: article } = await admin
    .from("articles")
    .select("title, blogs(name, theme)")
    .eq("id", articleId)
    .maybeSingle();

  const blog = article?.blogs as
    | { name: string; theme: { primary_color: string } }
    | undefined;

  const title = article?.title ?? "";
  const blogName = blog?.name ?? "";
  const color = blog?.theme?.primary_color ?? "#22518a";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: `linear-gradient(135deg, ${color} 0%, #0b1220 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "rgba(255,255,255,0.75)",
            fontWeight: 600,
          }}
        >
          {blogName}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: title.length > 70 ? 56 : 72,
            lineHeight: 1.15,
            color: "#ffffff",
            fontWeight: 700,
            maxWidth: "1000px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            width: "120px",
            height: "8px",
            borderRadius: "4px",
            background: "rgba(255,255,255,0.9)",
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
