import { ImageResponse } from "next/og";
import { textoSobre } from "@/lib/contrast";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_DA_CAPA } from "@/lib/blog-endereco";
import { acessoAoArtigo, SEM_CACHE } from "@/lib/artigo/acesso";

// Capa gerada na hora, com a cor da marca do cliente. Serve como imagem
// do artigo no blog E como preview quando alguém compartilha o link no
// WhatsApp/LinkedIn (Open Graph). Sem depender de banco de imagens nem
// de geração por IA - custo zero e sempre on-brand.
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
  { params }: { params: Promise<{ articleId: string }> },
) {
  const { articleId } = await params;
  const admin = createAdminClient();

  const { data: article } = await admin
    .from("articles")
    .select("title, status, blogs(name, theme)")
    .eq("id", articleId)
    .maybeSingle();

  const acesso = await acessoAoArtigo(articleId, article?.status);
  if (!article || !acesso) {
    return new Response("not found", { status: 404 });
  }

  // O Supabase tipa a relação como lista; em runtime vem o objeto.
  const blog = article.blogs as unknown as
    | { name: string; theme: TemaDaMarca }
    | undefined;

  const title = article.title ?? "";
  const blogName = blog?.name ?? "";
  const color = blog?.theme?.primary_color ?? "#15191c";
  // A capa era um degradê da cor da marca para um azul-preto fixo: em marca
  // clara o título branco sumia, e o degradê entregava um azul que não era
  // do cliente. Campo chapado na cor dele, texto escolhido pelo contraste.
  const tinta = textoSobre(color);
  const logo = logoDoTema(blog?.theme, 64);
  const filete = acento(blog?.theme, tinta);

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
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: tinta,
              opacity: 0.75,
              fontWeight: 600,
            }}
          >
            {blogName}
          </div>
        )}

        <div
          style={{
            display: "flex",
            fontSize: title.length > 70 ? 56 : 72,
            lineHeight: 1.15,
            color: tinta,
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
            background: filete,
            opacity: 0.9,
          }}
        />
      </div>
    ),
    {
      width: 1200, height: 630,
      // Navegador revalida sempre (max-age=0); a CDN guarda por um dia e
      // serve a cópia velha enquanto renova. A URL carrega ?v=<identidade>,
      // então trocar nome, cor ou logo muda a URL e fura o cache na hora.
      headers: { "Cache-Control": acesso === "publico" ? CACHE_DA_CAPA : SEM_CACHE },
    },
  );
}
