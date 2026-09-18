import { createClient } from "@/lib/supabase/server";

// Capa e carrossel são desenhados com o client admin, que ignora a RLS -
// então quem decide se a imagem pode sair é esta função. Publicado sai para
// qualquer um (é o preview do link no WhatsApp). Rascunho só para quem é do
// workspace, conferido pela sessão e pela RLS: o id aparece em URL pública,
// e sem isto quem tivesse o id de um rascunho veria a capa dele.
// Revisão de segurança de 17/09, item S4.
export async function acessoAoArtigo(
  id: string,
  status: string | null | undefined,
): Promise<"publico" | "privado" | null> {
  if (status === "published") return "publico";
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return data ? "privado" : null;
}

// Rascunho não pode entrar no cache da CDN: a primeira visita seria do
// dono, logado, e a cópia guardada serviria a imagem a qualquer outro.
export const SEM_CACHE = "private, no-store";
