import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUserAndWorkspace } from "@/lib/workspace";
import {
  trocarCodigoPorTokens,
  buscarEmailDaConta,
  salvarConexao,
} from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";
const DESTINO = "/settings/integrations";

// Volta do Google com o código (ou com um erro, se o usuário cancelou).
// Sempre redireciona de volta para a tela de Integrações - sucesso e falha
// terminam no mesmo lugar, com uma mensagem diferente na URL.
export async function GET(request: Request) {
  const { workspace } = await requireUserAndWorkspace();
  const url = new URL(request.url);

  const erroGoogle = url.searchParams.get("error");
  if (erroGoogle) {
    return NextResponse.redirect(
      new URL(`${DESTINO}?erro=cancelado`, url.origin),
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const stateEsperado = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  // state não bate: ou o link foi reaproveitado, ou é uma tentativa de
  // forjar o callback. Não prossegue.
  if (!code || !state || state !== stateEsperado) {
    return NextResponse.redirect(
      new URL(`${DESTINO}?erro=estado_invalido`, url.origin),
    );
  }

  try {
    const tokens = await trocarCodigoPorTokens(code);

    if (!tokens.refresh_token) {
      // Acontece quando a conta já tinha autorizado antes e o Google não
      // reemitiu o refresh_token. access_type=offline + prompt=consent
      // deveriam evitar isso, mas se acontecer o usuário precisa revogar o
      // acesso em myaccount.google.com/permissions e tentar de novo.
      return NextResponse.redirect(
        new URL(`${DESTINO}?erro=sem_refresh_token`, url.origin),
      );
    }

    const email = await buscarEmailDaConta(tokens.access_token);
    await salvarConexao({
      workspaceId: workspace.id,
      email,
      refreshToken: tokens.refresh_token,
    });

    return NextResponse.redirect(new URL(`${DESTINO}?conectado=1`, url.origin));
  } catch (err) {
    console.error("[integrations/google/callback] falha", err);
    return NextResponse.redirect(new URL(`${DESTINO}?erro=falha`, url.origin));
  }
}
