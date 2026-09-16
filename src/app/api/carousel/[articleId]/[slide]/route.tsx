import { ImageResponse } from "next/og";
import { textoSobre } from "@/lib/contrast";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_DA_CAPA } from "@/lib/blog-endereco";

// 1080x1350 (proporção 4:5): o formato que ocupa mais espaço no feed do
// Instagram hoje, tanto em post único quanto em carrossel.
const LARGURA = 1080;
const ALTURA = 1350;

// Mesmo motor da capa do artigo (/api/og) - Satori renderiza HTML/CSS em
// imagem na hora, sem gerar arquivo, sem custo de IA por imagem. Pública
// (sem checar sessão) de propósito: precisa ser um link direto para o
// cliente baixar ou colar no Instagram, igual à capa.
type TemaDaMarca = {
  primary_color: string;
  secondary_color?: string | null;
  logo_url?: string | null;
  logo_ratio?: number | null;
};

// Logo desenhado no servidor precisa de largura E altura: o satori não
// busca a imagem para descobrir a proporção. Por isso ela é medida no
// navegador, na hora do envio, e guardada no tema. SVG fica de fora daqui
// (no blog ele aparece normal) - o satori nem sempre desenha SVG remoto, e
// capa quebrada é pior que capa sem logo.
function logoDoTema(tema: TemaDaMarca | undefined, altura: number) {
  const url = tema?.logo_url;
  if (!url || url.toLowerCase().split("?")[0].endsWith(".svg")) return null;
  const proporcao = tema?.logo_ratio && tema.logo_ratio > 0 ? tema.logo_ratio : 3;
  return { url, altura, largura: Math.round(altura * proporcao) };
}

// Acento: a cor secundária, quando o cliente escolheu uma diferente do
// fundo. Igual à principal, o filete sumiria.
function acento(tema: TemaDaMarca | undefined, tinta: string) {
  const s = tema?.secondary_color;
  return s && s.toLowerCase() !== tema?.primary_color?.toLowerCase() ? s : tinta;
}


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
    | { name: string; theme: TemaDaMarca }
    | undefined;
  const color = blog?.theme?.primary_color ?? "#15191c";
  const tinta = textoSobre(color);
  const logo = logoDoTema(blog?.theme, 56);
  const filete = acento(blog?.theme, tinta);
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
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse não usa next/image
          <img
            src={logo.url}
            alt=""
            width={logo.largura}
            height={logo.altura}
            style={{ objectFit: "contain" }}
          />
        ) : (
          <div style={{ display: "flex", fontSize: 30, color: tinta, opacity: 0.75, fontWeight: 600 }}>
            {blog?.name ?? ""}
          </div>
        )}

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
            background: filete,
            opacity: ehUltimo ? 0 : 0.9,
          }}
        />
      </div>
    ),
    {
      width: LARGURA, height: ALTURA,
      // Navegador revalida sempre (max-age=0); a CDN guarda por um dia e
      // serve a cópia velha enquanto renova. A URL carrega ?v=<identidade>,
      // então trocar nome, cor ou logo muda a URL e fura o cache na hora.
      headers: { "Cache-Control": CACHE_DA_CAPA },
    },
  );
}
