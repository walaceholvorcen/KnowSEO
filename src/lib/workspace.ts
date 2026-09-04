import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Blog, Workspace } from "@/types";

// MVP: 1 usuário -> 1 workspace principal (o schema já suporta N workspaces
// e N membros por workspace para quando entrarmos no caso de uso de agência).
export async function requireUserAndWorkspace() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    // Usuário autenticado mas sem workspace ainda (edge case raro - o
    // signup normalmente já cria um). Manda para o fluxo de criação.
    redirect("/onboarding/workspace");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", membership.workspace_id)
    .single();

  if (!workspace) {
    redirect("/onboarding/workspace");
  }

  return { supabase, user, workspace: workspace as Workspace };
}

export async function getWorkspaceBlogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<Blog[]> {
  const { data } = await supabase
    .from("blogs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  return (data as Blog[]) ?? [];
}

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
