// Onde o navegador avisa o que a CSP bloquearia (src/lib/csp.ts). Vai para
// o log da Vercel: é a leitura da semana em Report-Only antes de a política
// passar a bloquear de verdade. Sem banco de propósito - é um sinal
// temporário, e uma tabela aberta para POST anônimo viraria lixeira.
export async function POST(request: Request) {
  // Corpo limitado: a rota é pública, e o log não pode virar depósito.
  const corpo = (await request.text()).slice(0, 2000);
  try {
    const r = JSON.parse(corpo)["csp-report"] ?? {};
    console.warn(
      "[csp] violação",
      JSON.stringify({
        pagina: r["document-uri"],
        diretiva: r["violated-directive"] ?? r["effective-directive"],
        bloqueado: r["blocked-uri"],
        origem: r["source-file"],
        linha: r["line-number"],
      }),
    );
  } catch {
    console.warn("[csp] relatório ilegível", corpo.slice(0, 300));
  }
  return new Response(null, { status: 204 });
}
