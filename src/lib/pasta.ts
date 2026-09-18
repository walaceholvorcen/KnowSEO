import { getDomain } from "tldts";

// Blog numa PASTA do site do cliente: cliente.com/blog.
//
// É o formato que mais ajuda o SEO dele - o Google trata a pasta como parte
// do site, então cada artigo soma autoridade ao domínio inteiro, enquanto
// blog.cliente.com é lido quase como um site à parte. O preço é que o
// servidor do cliente precisa encaminhar a pasta para nós. O caminho
// suportado é um Worker do Cloudflare (plano grátis), cujo código sai
// pronto de codigoDoWorker().
//
// A regra de segurança de sempre continua valendo: o site do cliente nunca
// é substituído. A pasta precisa existir no endereço (sem ela o blog
// ocuparia a página inicial), e o Worker devolve ao servidor dele tudo o
// que estiver fora da pasta, sem tocar.

/** Cabeçalho com que o Worker diz ao app de qual pasta o pedido veio. */
export const CABECALHO_PASTA = "x-knowseo-pasta";

/** Caminho do app que atende os pedidos vindos do Worker. */
export const ROTA_DA_PASTA = "/pasta";

export type PastaNormalizada = { url: string; host: string; caminho: string };

/**
 * "cliente.com/blog/" → "https://cliente.com/blog". Devolve o erro em
 * português quando o endereço não serve. A mesma função valida o que o
 * cliente digita, o que vai para o banco e o cabeçalho que o Worker manda.
 */
export function normalizarPasta(
  entrada: string,
  appDomain?: string,
): PastaNormalizada | { erro: string } {
  let texto = String(entrada ?? "").trim();
  if (!texto) return { erro: "Informe o endereço da pasta, como https://cliente.com/blog." };
  if (!/^[a-z]+:\/\//i.test(texto)) texto = `https://${texto}`;

  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return { erro: "Endereço inválido. Use o formato https://cliente.com/blog." };
  }
  if (u.protocol !== "https:") return { erro: "O endereço precisa começar com https://." };
  if (u.username || u.password || u.port) {
    return { erro: "Use só o endereço do site e a pasta, como https://cliente.com/blog." };
  }
  if (u.search || u.hash) return { erro: "Tire o ? ou o # do endereço: só o site e a pasta." };

  const host = u.hostname.replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^\d+(\.\d+){3}$/.test(host)) {
    return { erro: "Não reconhecemos esse domínio. Confira o endereço do site." };
  }
  if (host === "vercel.app" || host.endsWith(".vercel.app") || (appDomain && host === appDomain.split(":")[0])) {
    return { erro: "Esse é o endereço da plataforma. Use o domínio do site do cliente." };
  }
  if (!getDomain(host)) return { erro: "Não reconhecemos esse domínio. Confira o endereço do site." };

  const caminho = u.pathname.replace(/\/+$/, "");
  if (!caminho) {
    return {
      erro: "Falta a pasta no fim do endereço, como /blog. Sem ela o blog ocuparia a página inicial do site.",
    };
  }
  if (!/^(\/[a-z0-9-]+){1,3}$/.test(caminho)) {
    return { erro: "Na pasta, use só letras minúsculas, números e hífen, como /blog." };
  }
  return { url: `https://${host}${caminho}`, host, caminho };
}

/**
 * O código que o cliente cola no Worker do Cloudflare. Sem o slug do blog:
 * o app descobre o blog pelo endereço da pasta. Com o slug gravado aqui,
 * renomear o blog quebraria o Worker - pior, o 301 do slug antigo mandaria
 * o visitante de volta para a pasta, e a pasta de volta para o slug antigo.
 *
 * Três proteções para o resto do site do cliente:
 * - fora da pasta, o pedido segue intocado para o servidor dele - mesmo que
 *   a rota do Cloudflare seja cadastrada larga demais ("cliente.com/*");
 * - o cookie do site não vem para nós;
 * - Strict-Transport-Security e Set-Cookie da nossa resposta não voltam: o
 *   HSTS da Vercel vale para o domínio e TODOS os subdomínios por 2 anos, e
 *   derrubaria qualquer subdomínio dele que ainda não tenha https.
 */
export function codigoDoWorker(pastaUrl: string, appOrigin: string): string {
  const caminho = new URL(pastaUrl).pathname;
  const destino = `${appOrigin}${ROTA_DA_PASTA}`;
  return [
    `// Blog na pasta ${caminho} deste site - Know SEO.`,
    `// Só responde dentro de ${caminho}. Qualquer outro endereço do site segue`,
    `// para o servidor de sempre, sem passar por aqui.`,
    `const ENDERECO = ${JSON.stringify(pastaUrl)};`,
    `const PASTA = ${JSON.stringify(caminho)};`,
    `const APP = ${JSON.stringify(destino)};`,
    ``,
    `export default {`,
    `  async fetch(request) {`,
    `    const url = new URL(request.url);`,
    `    const naPasta = url.pathname === PASTA || url.pathname.startsWith(PASTA + "/");`,
    `    if (!naPasta) return fetch(request);`,
    ``,
    `    const headers = new Headers(request.headers);`,
    `    headers.set(${JSON.stringify(CABECALHO_PASTA)}, ENDERECO);`,
    `    headers.delete("cookie");`,
    `    const semCorpo = request.method === "GET" || request.method === "HEAD";`,
    `    const resposta = await fetch(APP + url.pathname.slice(PASTA.length) + url.search, {`,
    `      method: request.method,`,
    `      headers,`,
    `      body: semCorpo ? undefined : request.body,`,
    `      redirect: "manual",`,
    `    });`,
    ``,
    `    const saida = new Response(resposta.body, resposta);`,
    `    saida.headers.delete("strict-transport-security");`,
    `    saida.headers.delete("set-cookie");`,
    `    const destino = saida.headers.get("location");`,
    `    if (destino) {`,
    `      const caminho = destino.startsWith(APP) ? destino.slice(APP.length)`,
    `        : destino.startsWith(${JSON.stringify(ROTA_DA_PASTA)}) ? destino.slice(${ROTA_DA_PASTA.length}) : null;`,
    `      if (caminho !== null) saida.headers.set("location", ENDERECO + caminho);`,
    `    }`,
    `    return saida;`,
    `  },`,
    `};`,
    ``,
  ].join("\n");
}

/** Passo a passo para o cliente, em linguagem de quem nunca abriu o Cloudflare. */
export function passosDaPasta(pastaUrl: string): string[] {
  const { host, pathname } = new URL(pastaUrl);
  const zona = getDomain(host) ?? host;
  return [
    `Entre no Cloudflare (dash.cloudflare.com) com a conta onde está o domínio ${zona}. O registro do site precisa estar com a nuvem laranja ligada (Proxied) - é assim que o Cloudflare passa a atender o site.`,
    `No menu da esquerda, abra Workers & Pages, clique em Create e depois em Create Worker. Dê o nome knowseo-blog e clique em Deploy.`,
    `Clique em Edit code, apague tudo o que estiver lá, cole o código abaixo e clique em Deploy de novo.`,
    `Volte ao Worker, abra Settings, depois Domains & Routes, e clique em Add e em Route. Em Zone escolha ${zona}; em Route escreva ${host}${pathname}* e salve.`,
    `Pronto. ${pastaUrl} passa a mostrar o blog em poucos minutos. O resto do site continua exatamente como está: o código só responde dentro de ${pathname}.`,
    `Para o Google achar os artigos mais rápido: no Search Console do site, em Sitemaps, envie ${pastaUrl}/sitemap.xml.`,
  ];
}
