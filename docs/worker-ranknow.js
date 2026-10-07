// Worker do Cloudflare que põe o painel em ranknow.es/login.
//
// A landing page continua respondendo em tudo o mais: este Worker só
// desvia os caminhos da lista abaixo para o app na Vercel, e devolve
// qualquer outro pedido intocado para o servidor do site (Hostinger).
//
// Instalar em: Cloudflare (conta do ranknow.es) > Workers & Pages >
// Create > Worker. Cole este arquivo, publique, e em Settings > Domains &
// Routes adicione a rota  ranknow.es/*  (e  www.ranknow.es/*  se o www não
// for só um redirecionamento).
//
// ATENÇÃO, na ordem em que isto quebra se for esquecido:
//
// 1. ORIGEM. O Worker busca em app.ranknow.es, NÃO em know-seo.vercel.app.
//    O app redireciona o endereço antigo (DOMINIO_ANTIGO) para o novo - se
//    a origem fosse o endereço antigo, cada pedido do Worker voltaria
//    redirecionado para ranknow.es e o laço nunca fecharia.
// 2. HSTS. A Vercel responde com Strict-Transport-Security incluindo
//    subdomínios. Repassado, ele passaria a valer para ranknow.es e TODOS
//    os subdomínios dela por dois anos - inclusive os que ainda não têm
//    https. Por isso o cabeçalho é removido na saída.
// 3. COOKIE. Ao contrário do Worker do blog, este PRECISA repassar
//    Set-Cookie: é como a sessão do painel é gravada. Consequência a ter
//    clara: a sessão passa a morar na mesma origem da landing page.
// 4. /robots.txt e /favicon.ico ficam DE FORA da lista de propósito: são do
//    site, não do app. O robots do app (que bloqueia /b/ e /api/) deixa de
//    valer em ranknow.es, então a proteção de prévia do blog passa a
//    depender só do `noindex` das páginas.

const ORIGEM = "https://app.ranknow.es";

// Tudo que o painel serve. Caminho novo no app = linha nova aqui.
const DO_APP = [
  // porta de entrada
  "/login",
  "/signup",
  "/esqueci",
  "/nova-senha",
  "/onboarding",
  // painel
  "/dashboard",
  "/audit",
  "/visibility",
  "/market",
  "/gbp",
  "/strategy",
  "/contents",
  "/calendar",
  "/reports",
  "/settings",
  // máquina: ação de servidor, rota de API, callback do Google,
  // prévia do blog e relatório público do cliente
  "/api/",
  "/auth/",
  "/b/",
  "/r/",
];

function ehDoApp(caminho) {
  return DO_APP.some(
    (p) => caminho === p || caminho.startsWith(p.endsWith("/") ? p : p + "/"),
  );
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Qualquer coisa fora da lista volta para o site, sem ser tocada.
    if (!ehDoApp(url.pathname)) return fetch(request);

    const destino = new URL(url.pathname + url.search, ORIGEM);

    const resposta = await fetch(destino, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      // manual: um 302 para /dashboard tem de chegar ao navegador como 302
      // em ranknow.es, não ser seguido aqui dentro.
      redirect: "manual",
    });

    const headers = new Headers(resposta.headers);
    headers.delete("Strict-Transport-Security");

    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers,
    });
  },
};
