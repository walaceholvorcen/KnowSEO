import { redirect } from "next/navigation";
import { pagina } from "@/components/ui";
import { requireUserAndWorkspace, getBlogAtivo } from "@/lib/workspace";
import type { BrandDna } from "@/types";
import { SettingsNav } from "../settings-nav";
import { BrandDnaForm } from "./brand-dna-form";
import { IdentidadeForm } from "./identidade-form";
import { Lede, Secao } from "@/components/lede";

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
  const blog = await getBlogAtivo(supabase, workspace.id);
  if (!blog) redirect("/onboarding");

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
    <div className={pagina("estreita")}>
      <SettingsNav />
      <Lede apoio="Isso alimenta o prompt de todo artigo gerado pela IA - é a diferença entre um texto genérico e um com a voz da sua marca.">
        {veredito}
      </Lede>
      <BrandDnaForm blogId={blog.id} initial={perfil} />

      <Secao>Identidade da marca</Secao>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Usado pelo Raio X - GEO para reconhecer você numa resposta de IA. Se a
        marca tiver apelido, grafia alternativa ou outro domínio e eles não
        estiverem aqui, uma citação real passa despercebida e conta como
        derrota.
      </p>
      <IdentidadeForm
        blogId={blog.id}
        nomeDoBlog={blog.name}
        dominioProprio={blog.custom_domain}
        initialNames={blog.brand_names ?? []}
        initialDomains={blog.brand_domains ?? []}
      />
    </div>
  );
}
