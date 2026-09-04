import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import type { AnalyticsEvent } from "@/types";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
        {value.toLocaleString("es-ES")}
      </p>
    </div>
  );
}

export default async function ReportsPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const since = new Date();
  since.setDate(since.getDate() - 28);

  const { data: events } = await supabase
    .from("analytics_events")
    .select("*")
    .eq("blog_id", blog.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  const list = (events as AnalyticsEvent[]) ?? [];
  const pageviews = list.filter((e) => e.event_type === "pageview").length;
  const ctaClicks = list.filter((e) => e.event_type === "cta_click").length;
  const whatsappClicks = list.filter(
    (e) => e.event_type === "whatsapp_click",
  ).length;

  const byPath = new Map<string, number>();
  for (const e of list) {
    if (e.event_type !== "pageview" || !e.path) continue;
    byPath.set(e.path, (byPath.get(e.path) ?? 0) + 1);
  }
  const topPages = [...byPath.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Relatórios</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Dados de primeira parte - já ativos desde a primeira publicação, sem
        precisar conectar Google Analytics.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Visitas (28 dias)" value={pageviews} />
        <StatCard label="Cliques em CTA" value={ctaClicks} />
        <StatCard label="Cliques no WhatsApp" value={whatsappClicks} />
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Páginas mais visitadas
        </h3>
        {topPages.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Ainda não há visitas registradas. Publique e compartilhe seu
            primeiro artigo.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {topPages.map(([path, count]) => (
              <li
                key={path}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="truncate text-slate-600 dark:text-slate-400">{path}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
