// Opções do cookie de sessão do Supabase. Usadas pelos dois clients de
// servidor (server.ts e middleware.ts) - o navegador não tem client.
//
// httpOnly é o ponto inteiro: o padrão do @supabase/ssr é false, para o
// client do navegador conseguir ler o token. Esse cookie guarda o refresh
// token, que renova sozinho, então um XSS que lesse document.cookie levava
// uma sessão que não expira. Revisão de segurança de 17/09, item S1a.
//
// secure só em produção: em http://localhost o navegador descartaria o
// cookie e o login local pararia de funcionar.
export const COOKIE_DE_SESSAO = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// sb-<projeto>-auth-token, e os pedaços .0 .1 quando ele é grande. O
// code-verifier do fluxo de senha também é da sessão e também fica fechado.
export function ehCookieDeSessao(nome: string): boolean {
  return /^sb-.+-auth-token(-code-verifier)?(\.\d+)?$/.test(nome);
}
