import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Destino do link que chega por e-mail (recuperação de senha, confirmação
// de conta). Aqui o código vira sessão antes de o usuário ver qualquer tela.
//
// Aceita os DOIS formatos de propósito: `code` (fluxo PKCE, padrão do
// @supabase/ssr) e `token_hash` + `type` (modelo de e-mail mais antigo do
// Supabase). Qual deles chega depende do template configurado no projeto, e
// errar isso deixaria o cliente trancado para fora justamente na tela que
// existe para destrancá-lo.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  // Só caminho interno: destino vindo da URL não pode virar redirecionamento
  // aberto para fora do app.
  const bruto = url.searchParams.get("destino") ?? "/nova-senha";
  const destino = bruto.startsWith("/") && !bruto.startsWith("//") ? bruto : "/nova-senha";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }

  return NextResponse.redirect(new URL("/login?erro=link_invalido", url.origin));
}
