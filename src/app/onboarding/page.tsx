import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { CreateBlogForm } from "./create-blog-form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  // A mesma tela serve para o primeiro blog e para cada cliente novo da
  // agência; sem o "?novo=1" ela continua sendo passagem só de ida.
  const novoCliente = (await searchParams).novo === "1";

  if (blogs.length > 0 && !novoCliente) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {novoCliente ? "Adicionar cliente" : "Crie seu primeiro blog"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {novoCliente
              ? "Cada cliente tem blog, auditoria e Raio X - GEO próprios. Você troca de cliente pela barra lateral."
              : "Em segundos você tem um endereço no ar para começar a publicar."}
          </p>
        </div>
        <CreateBlogForm workspaceId={workspace.id} />
      </div>
    </div>
  );
}
