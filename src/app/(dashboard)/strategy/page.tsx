import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import type { Keyword } from "@/types";
import { StrategyBoard } from "./strategy-board";

export default async function StrategyPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: keywords } = await supabase
    .from("keywords")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false });

  return (
    <StrategyBoard
      blogId={blog.id}
      initialKeywords={(keywords as Keyword[]) ?? []}
      credits={workspace.credits}
    />
  );
}
