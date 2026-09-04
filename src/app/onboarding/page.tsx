import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { CreateBlogForm } from "./create-blog-form";

export default async function OnboardingPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);

  if (blogs.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Crea tu primer blog
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            En unos segundos tendrás una URL activa donde empezaremos a
            publicar contenido.
          </p>
        </div>
        <CreateBlogForm workspaceId={workspace.id} />
      </div>
    </div>
  );
}
