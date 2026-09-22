"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { campo, folha } from "@/components/ui";
import { BotaoSalvar } from "@/components/botao-salvar";
import { cn } from "@/lib/utils";
import type { Autor } from "@/lib/autor";
import { salvarAutor } from "../../acoes";

// Quem assina os artigos. Aparece no topo e no fim de cada artigo e vai no
// dado estruturado que o Google e as IAs leem - ver src/lib/autor.ts.
export function AutorForm({
  blogId,
  inicial,
}: {
  blogId: string;
  inicial: Autor | null;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [cargo, setCargo] = useState(inicial?.cargo ?? "");
  const [bio, setBio] = useState(inicial?.bio ?? "");
  const [perfil, setPerfil] = useState(inicial?.perfil ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setSalvo(false);
    setErro(null);
    const r = await salvarAutor(blogId, { nome, cargo, bio, perfil });
    setSalvando(false);
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    // O servidor devolve o que gravou (perfil com https completado, espaços
    // limpos): a tela mostra o mesmo que o blog vai mostrar.
    setPerfil(r.autor?.perfil ?? "");
    setSalvo(true);
    router.refresh();
  }

  const rotulo = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

  return (
    <form
      onSubmit={salvar}
      className={folha()}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="autor-nome" className={rotulo}>
            Nome
          </label>
          <input
            id="autor-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="María García"
            maxLength={80}
            className={cn(campo(), "w-full")}
          />
        </div>
        <div>
          <label htmlFor="autor-cargo" className={rotulo}>
            Cargo
          </label>
          <input
            id="autor-cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Fundadora e especialista em Google Ads"
            maxLength={80}
            className={cn(campo(), "w-full")}
          />
        </div>
      </div>

      <div>
        <label htmlFor="autor-bio" className={rotulo}>
          Sobre a pessoa
        </label>
        <p className="mb-1.5 text-sm text-slate-500 dark:text-slate-400">
          Duas ou três frases com fato, não adjetivo: anos de área, clientes
          atendidos, certificações. Sai no idioma em que for escrita.
        </p>
        <textarea
          id="autor-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="12 años gestionando campañas de Google Ads para pymes en España. Partner certificada de Google."
          className={cn(campo(), "w-full")}
        />
      </div>

      <div>
        <label htmlFor="autor-perfil" className={rotulo}>
          Perfil público
        </label>
        <p className="mb-1.5 text-sm text-slate-500 dark:text-slate-400">
          LinkedIn ou a página &ldquo;sobre&rdquo; do site. É o que prova que
          a pessoa existe.
        </p>
        <input
          id="autor-perfil"
          value={perfil}
          onChange={(e) => setPerfil(e.target.value)}
          placeholder="https://www.linkedin.com/in/..."
          className={cn(campo(), "w-full")}
        />
      </div>

      <BotaoSalvar salvando={salvando} salvo={salvo} />
      {erro && <p className="text-sm text-nota-critico">{erro}</p>}
    </form>
  );
}
