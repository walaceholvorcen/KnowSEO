import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import type { AiQuery, AiVisibilityCheck } from "@/types";
import { VisibilityBoard } from "./visibility-board";

export default async function VisibilityPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const [{ data: queries }, { data: checks }] = await Promise.all([
    supabase
      .from("ai_queries")
      .select("*")
      .eq("blog_id", blog.id)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("ai_visibility_checks")
      .select("*")
      .eq("blog_id", blog.id)
      .order("checked_at", { ascending: false })
      .limit(500),
  ]);

  return (
    <VisibilityBoard
      blogId={blog.id}
      queries={(queries as AiQuery[]) ?? []}
      checks={(checks as AiVisibilityCheck[]) ?? []}
    />
  );
}
