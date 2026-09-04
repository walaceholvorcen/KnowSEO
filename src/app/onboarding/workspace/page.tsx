import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateWorkspaceForm } from "./create-workspace-form";

// Fallback para quando existe um usuário autenticado sem nenhum workspace
// ainda - normalmente o /signup já cria o workspace na hora, mas isso
// pode acontecer com login social ou um usuário criado direto via API.
export default async function CreateWorkspacePage() {
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

  if (membership) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Crea tu espacio de trabajo
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Es donde vivirán tus blogs y tu contenido.
          </p>
        </div>
        <CreateWorkspaceForm userId={user.id} userEmail={user.email ?? ""} />
      </div>
    </div>
  );
}
