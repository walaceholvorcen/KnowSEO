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

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS }];
  },
};

export default nextConfig;
