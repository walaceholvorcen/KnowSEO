import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import type { BrandDna } from "@/types";
import { SettingsNav } from "../settings-nav";
import { BrandDnaForm } from "./brand-dna-form";
import { Lede } from "@/components/lede";

// Campos opcionais que realmente mudam o tom do artigo. "tone" fica de fora
// porque nasce com valor padrão - vazio nele seria bug, não sinal de
// DNA incompleto.
const CAMPOS_DE_VOZ = [
  "description",
  "target_audience",
  "writing_style",
  "banned_topics",
  "banned_words",
] as const;

export default async function BrandDnaPage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const { data: dna } = await supabase
    .from("brand_dna")
    .select("*")
    .eq("blog_id", blog.id)
    .maybeSingle();

  const perfil = dna as BrandDna | null;
  const preenchidos = CAMPOS_DE_VOZ.filter((c) => perfil?.[c]?.trim()).length;

  const veredito =
    preenchidos === 0
      ? "O DNA da marca está vazio. Sem ele, todo artigo sai com tom genérico."
      : preenchidos === CAMPOS_DE_VOZ.length
        ? "DNA completo. Todo artigo novo usa este tom e estas regras."
        : `DNA parcial: ${preenchidos} de ${CAMPOS_DE_VOZ.length} campos preenchidos.`;

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <SettingsNav />
      <Lede apoio="Isso alimenta o prompt de todo artigo gerado pela IA - é a diferença entre um texto genérico e um com a voz da sua marca.">
        {veredito}
      </Lede>
      <BrandDnaForm blogId={blog.id} initial={perfil} />
    </div>
  );
}
