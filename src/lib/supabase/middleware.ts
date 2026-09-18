import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_DE_SESSAO, ehCookieDeSessao } from "./cookie";

// Refresca o token de sessão do Supabase a cada request (necessário no
// App Router porque Server Components não conseguem escrever cookies).
export async function updateSession(
  request: NextRequest,
  extras: Record<string, string> = {},
) {
  // Cabeçalhos extras vão no pedido que segue para a página - é de lá que o
  // Next lê o nonce da CSP. Recalculado a cada vez, porque setAll abaixo
  // muda o cookie do pedido.
  const seguir = () => {
    const headers = new Headers(request.headers);
    for (const [k, v] of Object.entries(extras)) headers.set(k, v);
    return NextResponse.next({ request: { headers } });
  };
  let response = seguir();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: COOKIE_DE_SESSAO,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = seguir();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims, não getUser: o projeto assina o token com chave assimétrica
  // (ES256), então a assinatura é conferida aqui mesmo contra a chave
  // pública, sem ida ao servidor de autenticação. getUser custava de 300 a
  // 700ms medidos - em TODA navegação do painel, antes de a página começar.
  // Continua renovando o token vencido e gravando os cookies novos.
  const { data } = await supabase.auth.getClaims();

  // Sessões abertas antes do cookie virar HttpOnly continuam com o cookie
  // antigo, legível por JavaScript, até o token ser renovado - até uma hora.
  // Regravar aqui fecha todas no primeiro pedido, sem forçar ninguém a
  // entrar de novo. Cookie que o Supabase já regravou acima fica como está.
  if (data?.claims.sub) {
    for (const { name, value } of request.cookies.getAll()) {
      if (ehCookieDeSessao(name) && !response.cookies.get(name)) {
        response.cookies.set(name, value, {
          ...COOKIE_DE_SESSAO,
          maxAge: 400 * 24 * 60 * 60,
        });
      }
    }
  }

  return { response, userId: data?.claims.sub ?? null };
}
