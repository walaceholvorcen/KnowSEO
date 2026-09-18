import type { NextConfig } from "next";

// Cabeçalhos de defesa em toda resposta. Revisão de segurança de 17/09,
// item S5. A CSP mora no proxy.ts, porque precisa de um nonce novo a cada
// pedido e aqui tudo é fixo.
const CABECALHOS = [
  // Enquanto a CSP estiver em Report-Only, o frame-ancestors dela só avisa.
  // É este cabeçalho que de fato impede outro site de embutir o painel num
  // iframe (clickjacking). SAMEORIGIN, e não DENY: a prévia do editor é um
  // iframe da própria origem.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

// Estilo, fonte e script do app sempre pelo endereço completo do app.
//
// Com o blog servido de dentro do site do cliente (cliente.com/blog, via
// Worker - src/lib/pasta.ts), um "/_next/..." relativo seria pedido ao
// servidor DELE: página sem estilo e sem o contador de visitas. A Vercel já
// entrega /_next/static com Access-Control-Allow-Origin: *, então a fonte
// carrega de outra origem (conferido em produção em 18/09).
//
// Só na produção: um deploy de prévia apontando para os arquivos da
// produção carregaria o JavaScript de outra versão. ASSET_PREFIX explícito
// serve para testar o modo pasta localmente com `next start`.
const dominioDoApp =
  process.env.NEXT_PUBLIC_APP_DOMAIN || process.env.VERCEL_PROJECT_PRODUCTION_URL;
const assetPrefix =
  process.env.ASSET_PREFIX ||
  (process.env.VERCEL_ENV === "production" && dominioDoApp
    ? `https://${dominioDoApp}`
    : undefined);

const nextConfig: NextConfig = {
  assetPrefix,
  async headers() {
    return [
      { source: "/:path*", headers: CABECALHOS },
      // Fonte de outra origem só carrega com este cabeçalho, e com o blog
      // numa pasta do site do cliente a fonte vem do app. A Vercel já o
      // manda em /_next/static; escrito aqui, deixa de depender disso.
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
