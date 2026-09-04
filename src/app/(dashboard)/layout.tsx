import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);

  if (blogs.length === 0) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar workspaceName={workspace.name} credits={workspace.credits} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
