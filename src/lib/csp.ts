// Content-Security-Policy do app e dos blogs. Revisão de segurança de
// 17/09, itens S1b e S2.
//
// A CSP é a rede embaixo das outras duas camadas: se um dia um HTML de fora
// escapar do htmlSeguro, o navegador ainda se recusa a rodar script que não
// traga o nonce desta requisição. O nonce é novo a cada pedido (proxy.ts) e
// o Next o aplica sozinho nos próprios scripts - lê do cabeçalho do pedido,
// inclusive no modo Report-Only.
//
// Escolhas que não são óbvias:
// - style-src sem nonce e com 'unsafe-inline': com nonce, o navegador passa
//   a ignorar 'unsafe-inline', e o painel inteiro usa style={} (cor da
//   marca, largura de barra). Estilo injetado não executa código; o risco
//   que importa é script.
// - img-src aceita qualquer https: o corpo de um artigo pode ter imagem de
//   qualquer site, e imagem não roda código.
// - connect-src só 'self' e o app: desde o S1a o navegador não fala mais
//   com o Supabase. Se alguém voltar a chamar um serviço externo do
//   navegador, a CSP avisa.
// - frame-ancestors 'self', não 'none': o editor mostra a prévia do artigo
//   num iframe da própria origem.
//
// `app` é a origem do app. Com o blog servido de dentro do site do cliente
// (cliente.com/blog), 'self' passa a ser o site dele - e estilo, fonte e o
// contador de visitas continuam vindo do app. No painel, app e 'self' são
// a mesma coisa. O relatório de violação também vai para o app: relativo,
// iria parar no servidor do cliente.
export function politicaDeSeguranca(nonce: string, dev: boolean, app: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' só em dev: o React usa eval para reconstruir a pilha de
    // erro do servidor no navegador. Em produção nada usa.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' ${app}`,
    `img-src 'self' data: blob: https: ${app}`,
    `font-src 'self' data: ${app}`,
    `connect-src 'self' ${app}`,
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `report-uri ${app}/api/csp`,
  ].join("; ");
}

// Report-Only primeiro, como pede a revisão: a política é publicada e o
// navegador informa o que ela bloquearia, sem bloquear. Depois de uma
// semana sem violação legítima no log (/api/csp), troque para
// "Content-Security-Policy" - é a única linha a mudar.
export const CABECALHO_CSP = "Content-Security-Policy-Report-Only";

export function novoNonce(): string {
  return btoa(crypto.randomUUID());
}
