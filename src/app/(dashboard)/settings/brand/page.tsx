import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import type { BrandDna } from "@/types";
import { SettingsNav } from "../settings-nav";
import { BrandDnaForm } from "./brand-dna-form";

export default async function BrandDnaPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: dna } = await supabase
    .from("brand_dna")
    .select("*")
    .eq("blog_id", blog.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configurações</h1>
      <SettingsNav />
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          DNA da Marca
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Essas informações alimentam todo artigo gerado pela IA.
        </p>
        <div className="mt-4">
          <BrandDnaForm blogId={blog.id} initial={dna as BrandDna | null} />
        </div>
      </div>
    </div>
  );
}
