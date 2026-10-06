import { redirect } from "next/navigation";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { limitesDoMes, mesDe, paraInput } from "@/lib/calendario";
import type { Article } from "@/types";
import { CalendarioBoard, type ItemDoDia } from "./calendario-board";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

  const { mes: pedido } = await searchParams;
  const agora = new Date();
  const mes = /^\d{4}-\d{2}$/.test(pedido ?? "") ? pedido! : mesDe(agora);
  const { inicio, fim } = limitesDoMes(mes);

  // Uma consulta só, o acervo inteiro: um blog tem dezenas de artigos, não
  // milhares, e filtrar por mês no banco exigiria duas consultas (agendados
  // por scheduled_at, publicados por published_at) para montar a mesma tela.
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, status, scheduled_at, published_at")
    .eq("blog_id", blog.id)
    .order("created_at", { ascending: false });

  const lista = (articles as Pick<
    Article,
    "id" | "title" | "status" | "scheduled_at" | "published_at"
  >[]) ?? [];

  const dentroDoMes = (iso: string | null) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return t >= inicio.getTime() && t < fim.getTime() + 86_400_000;
  };

  const hoje = paraInput(agora);
  const porDia = new Map<string, ItemDoDia[]>();
  const acrescentar = (dia: string, item: ItemDoDia) => {
    porDia.set(dia, [...(porDia.get(dia) ?? []), item]);
  };

  for (const a of lista) {
    if (a.status === "published" && dentroDoMes(a.published_at)) {
      acrescentar(paraInput(a.published_at!), {
        id: a.id,
        titulo: a.title,
        estado: "publicado",
      });
      continue;
    }
    // Rascunho com data que já passou: o robô não publicou. Ou ainda não
    // disparou, ou a trava de qualidade reprovou o texto - nos dois casos a
    // tela precisa mostrar, senão o artigo fica parado sem ninguém notar.
    if (a.status !== "published" && dentroDoMes(a.scheduled_at)) {
      const dia = paraInput(a.scheduled_at!);
      acrescentar(dia, {
        id: a.id,
        titulo: a.title,
        estado: dia < hoje ? "atrasado" : "agendado",
      });
    }
  }

  const semData = lista.filter(
    (a) => a.status !== "published" && !a.scheduled_at,
  );
  const agendadosNoMes = [...porDia.values()]
    .flat()
    .filter((i) => i.estado !== "publicado").length;
  const publicadosNoMes = [...porDia.values()]
    .flat()
    .filter((i) => i.estado === "publicado").length;

  const veredito =
    agendadosNoMes === 0 && publicadosNoMes === 0
      ? semData.length > 0
        ? `${semData.length} ${semData.length === 1 ? "rascunho pronto e sem data" : "rascunhos prontos e sem data"}.`
        : "Nenhuma publicação neste mês."
      : `${publicadosNoMes} no ar, ${agendadosNoMes} ${agendadosNoMes === 1 ? "agendado" : "agendados"} neste mês.`;

  return (
    <CalendarioBoard
      mes={mes}
      hoje={hoje}
      veredito={veredito}
      porDia={Object.fromEntries(porDia)}
      semData={semData.map((a) => ({ id: a.id, titulo: a.title }))}
    />
  );
}
