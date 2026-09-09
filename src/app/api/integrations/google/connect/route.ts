import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUserAndWorkspace } from "@/lib/workspace";
import {
  buildAuthUrl,
  isGoogleIntegrationConfigured,
} from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";

// Início do fluxo: exige sessão (só quem já está logado no Know SEO pode
// disparar isto), gera um nonce contra CSRF e manda para o Google.
export async function GET() {
  await requireUserAndWorkspace();

  if (!isGoogleIntegrationConfigured()) {
    return NextResponse.json(
      { error: "Integração com o Google não configurada." },
      { status: 503 },
    );
  }

  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
