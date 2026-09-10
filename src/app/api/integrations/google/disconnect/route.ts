import { NextResponse } from "next/server";
import { requireUserAndWorkspace } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";

// Apaga a conexão salva. Precisa ser rota de servidor com client admin:
// google_integration tem RLS sem nenhuma policy de propósito (guarda
// refresh_token), então nem o dono do workspace consegue apagar a linha
// pelo client do navegador.
export async function POST() {
  const { workspace } = await requireUserAndWorkspace();

  const admin = createAdminClient();
  const { error } = await admin
    .from("google_integration")
    .delete()
    .eq("workspace_id", workspace.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
