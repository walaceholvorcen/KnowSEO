"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarWorkspace, sair } from "@/app/acoes-de-conta";
import { SUBCONTA_COOKIE } from "@/lib/blog-cookie";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Trinta dias: o administrador volta à subconta em que estava, e de tempos
// em tempos cai no painel central - que é onde se vê quem está parado.
async function trabalharNa(subcontaId: string) {
  (await cookies()).set(SUBCONTA_COOKIE, subcontaId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function ehAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("eh_admin_da_agencia");
  return data === true;
}

export async function entrarNaSubconta(subcontaId: string): Promise<void> {
  if (!UUID.test(subcontaId)) return;

  // A RLS responde se esta pessoa pode ver a subconta. O cookie só é
  // gravado para o que ela alcança - e mesmo um cookie forjado é conferido
  // de novo a cada tela (requireUserAndWorkspace).
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", subcontaId)
    .maybeSingle();
  if (!data) return;

  await trabalharNa(subcontaId);
  // Subconta ainda sem blog cai sozinha na montagem: o layout do painel
  // manda para /onboarding.
  redirect("/dashboard");
}

export async function criarSubconta(
  _anterior: { erro: string | null },
  form: FormData,
): Promise<{ erro: string | null }> {
  if (!(await ehAdmin())) {
    return { erro: "Só administradores da agência criam subcontas." };
  }

  const nome = String(form.get("nome") ?? "").trim();
  if (nome.length < 2) return { erro: "Dê um nome ao cliente." };

  // O mesmo caminho do cadastro: a conta nasce e quem a criou entra como
  // dono. Subconta sem dono nenhum ficaria aberta à regra "entre num
  // workspace que ainda não tem ninguém" (migração 0015).
  const { erro, id } = await criarWorkspace(nome);
  if (erro || !id) return { erro: erro ?? "Não deu para criar a subconta." };

  await trabalharNa(id);
  redirect("/onboarding");
}

export async function sairDaAgencia(): Promise<void> {
  await sair();
  redirect("/login");
}
