import { NextResponse } from "next/server";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { foraDoIdioma, idiomaDoBlog } from "@/lib/idioma";

// Descarta de uma vez as pautas sugeridas que estão em outro idioma (o
// acervo gerado antes de `idiomaDoBlog`). A lista é recalculada aqui, não
// recebida do navegador: o servidor decide o que sai, e só pauta ainda
// "suggested" - a que já virou artigo não é tocada. Descartar é status
// 'rejected', nada é apagado.
export async function POST() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) {
    return NextResponse.json({ error: "blog not found" }, { status: 404 });
  }

  const { data: pautas, error: erroLeitura } = await supabase
    .from("keywords")
    .select("id, keyword, suggested_title")
    .eq("blog_id", blog.id)
    .eq("status", "suggested");
  if (erroLeitura) {
    return NextResponse.json({ error: erroLeitura.message }, { status: 500 });
  }

  const { codigo } = idiomaDoBlog(blog);
  const ids = (pautas ?? [])
    .filter((k) => foraDoIdioma(`${k.suggested_title ?? ""} ${k.keyword}`, codigo))
    .map((k) => k.id as string);

  if (ids.length) {
    const { error } = await supabase
      .from("keywords")
      .update({ status: "rejected" })
      .in("id", ids)
      // Reforço na própria gravação: só pauta ainda sugerida e deste blog,
      // mesmo que a lista de ids mude entre a leitura e o update.
      .eq("status", "suggested")
      .eq("blog_id", blog.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ids });
}
