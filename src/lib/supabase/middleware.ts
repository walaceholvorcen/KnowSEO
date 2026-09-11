import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca o token de sessão do Supabase a cada request (necessário no
// App Router porque Server Components não conseguem escrever cookies).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
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

  return { response, userId: data?.claims.sub ?? null };
}
