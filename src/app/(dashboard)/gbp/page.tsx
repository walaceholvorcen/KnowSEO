import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { GbpBoard } from "./gbp-board";

export interface GbpAuditRow {
  id: string;
  query: string;
  status: string;
  place_name: string | null;
  place_address: string | null;
  maps_uri: string | null;
  score: number | null;
  created_at: string;
}

export interface GbpFindingRow {
  id: number;
  audit_id: string;
  code: string;
  severity: string;
  title: string;
  impact: string | null;
  evidence: string | null;
  fix: string | null;
}

export default async function GbpPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: audits } = await supabase
    .from("gbp_audits")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const latest = (audits as GbpAuditRow[])?.find((a) => a.status === "done");

  const { data: findings } = latest
    ? await supabase
        .from("gbp_findings")
        .select("*")
        .eq("audit_id", latest.id)
    : { data: [] };

  return (
    <GbpBoard
      blogId={blog.id}
      latest={latest ?? null}
      findings={(findings as GbpFindingRow[]) ?? []}
    />
  );
}
