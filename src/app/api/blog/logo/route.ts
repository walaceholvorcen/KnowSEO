import { NextResponse } from "next/server";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";

// Logo do cliente. Fica no balde público `marca` do Supabase, não como
// endereço do site dele: logo servido do site do cliente costuma ter
// proteção contra link externo, e a capa do artigo e o carrossel precisam
// buscar a imagem do servidor para desenhar.
const TIPOS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const LIMITE = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) return NextResponse.json({ error: "sem blog" }, { status: 400 });

  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const proporcao = Number(form.get("proporcao")) || null;
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  }
  const extensao = TIPOS[arquivo.type];
  if (!extensao) {
    return NextResponse.json(
      { error: "Formato não aceito. Use PNG, JPG, WEBP ou SVG." },
      { status: 415 },
    );
  }
  if (arquivo.size > LIMITE) {
    return NextResponse.json(
      { error: "Imagem acima de 2 MB." },
      { status: 413 },
    );
  }

  // O balde é público (a capa e o carrossel são lidos por quem não tem
  // sessão), então quem escreve nele é o cliente de serviço - depois de a
  // rota já ter conferido que este blog é de quem está logado.
  const admin = createAdminClient();
  const caminho = `${blog.id}/logo-${Date.now()}.${extensao}`;
  const { error } = await admin.storage
    .from("marca")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("marca").getPublicUrl(caminho);

  // Grava já: se o cliente sair da tela sem salvar o resto, o logo que ele
  // acabou de subir continua valendo.
  await supabase
    .from("blogs")
    .update({
      theme: { ...blog.theme, logo_url: publicUrl, logo_ratio: proporcao },
    })
    .eq("id", blog.id);

  return NextResponse.json({ url: publicUrl });
}

export async function DELETE() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) return NextResponse.json({ error: "sem blog" }, { status: 400 });

  await supabase
    .from("blogs")
    .update({ theme: { ...blog.theme, logo_url: null, logo_ratio: null } })
    .eq("id", blog.id);

  return NextResponse.json({ ok: true });
}
