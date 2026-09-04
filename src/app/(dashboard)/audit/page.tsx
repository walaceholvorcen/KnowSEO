import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import { AuditBoard } from "./audit-board";

export interface AuditRow {
  id: string;
  site_url: string;
  status: string;
  pages_analyzed: number;
  score_google: number | null;
  score_ai: number | null;
  created_at: string;
}

export interface FindingRow {
  id: number;
  audit_id: string;
  code: string;
  severity: string;
  category: string;
  title: string;
  impact: string | null;
  evidence: string | null;
  fix: string | null;
  affected_urls: string[];
  affected_count: number;
}

export default async function AuditPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: audits } = await supabase
    .from("site_audits")
    .select("*")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const latest = (audits as AuditRow[])?.find((a) => a.status === "done");

  const { data: findings } = latest
    ? await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", latest.id)
    : { data: [] };

  return (
    <AuditBoard
      blogId={blog.id}
      audits={(audits as AuditRow[]) ?? []}
      latest={latest ?? null}
      findings={(findings as FindingRow[]) ?? []}
    />
  );
}
