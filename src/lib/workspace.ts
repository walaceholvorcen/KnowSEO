import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Blog, Workspace } from "@/types";

// MVP: 1 usuário -> 1 workspace principal (o schema já suporta N workspaces
// e N membros por workspace para quando entrarmos no caso de uso de agência).
//
// Isto roda antes de qualquer tela do painel mostrar alguma coisa, então
// cada ida ao banco aqui é espera que o cliente sente como "travou":
//
// - cache(): layout e página chamam esta função na mesma requisição. Sem o
//   cache, a mesma sequência de consultas rodava duas vezes seguidas.
// - getClaims(): confere o token localmente (chave assimétrica) em vez de
//   perguntar ao servidor de autenticação, que levava 300-700ms medidos.
//   As consultas seguintes continuam protegidas pelo RLS no banco.
// - vínculo e workspace numa consulta só, pelo relacionamento.
export const requireUserAndWorkspace = cache(async () => {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    redirect("/login");
  }

  const user = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const workspace = (membership as { workspace: Workspace | null } | null)
    ?.workspace;

  if (!workspace) {
    // Usuário autenticado mas sem workspace ainda (edge case raro - o
    // signup normalmente já cria um). Manda para o fluxo de criação.
    redirect("/onboarding/workspace");
  }

  return { supabase, user, workspace };
});

export const getWorkspaceBlogs = cache(
  async (
    supabase: Awaited<ReturnType<typeof createClient>>,
    workspaceId: string,
  ): Promise<Blog[]> => {
    const { data } = await supabase
      .from("blogs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    return (data as Blog[]) ?? [];
  },
);

// Marca um passo do onboarding como concluído e credita +1 artigo,
// só na primeira vez (idempotente) - é o mecanismo de "créditos por
// progresso" que substitui um trial por tempo.
export async function completeOnboardingStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspace: Workspace,
  step: keyof Workspace["onboarding_steps"],
) {
  if (workspace.onboarding_steps[step]) return; // já concluído, não recredita

  const updatedSteps = { ...workspace.onboarding_steps, [step]: true };

  await supabase
    .from("workspaces")
    .update({
      onboarding_steps: updatedSteps,
      credits: workspace.credits + 1,
    })
    .eq("id", workspace.id);
}
