"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Como a marca é escrita e onde ela mora.
//
// Estes dois campos existem no banco desde o primeiro dia do Radar GEO e
// nunca tiveram tela. Sem eles o detector de citação caía no nome do blog -
// que no banco de teste era literalmente "testando dataknow" -, e nenhuma
// menção real à marca casaria nunca. Vinte linhas de formulário separavam o
// módulo de funcionar de estar cego.

function Lista({
  titulo,
  ajuda,
  placeholder,
  itens,
  onChange,
  normalizar,
}: {
  titulo: string;
  ajuda: string;
  placeholder: string;
  itens: string[];
  onChange: (proximo: string[]) => void;
  normalizar?: (valor: string) => string;
}) {
  const [rascunho, setRascunho] = useState("");

  function adicionar() {
    const limpo = (normalizar ?? ((v: string) => v.trim()))(rascunho);
    if (!limpo || itens.includes(limpo)) return;
    onChange([...itens, limpo]);
    setRascunho("");
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {titulo}
      </label>
      <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{ajuda}</p>

      <div className="flex flex-wrap items-center gap-2">
        {itens.map((item) => (
          <span
            key={item}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 pl-3 pr-2 text-sm text-slate-700 dark:text-slate-300"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(itens.filter((i) => i !== item))}
              aria-label={`Remover ${item}`}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </span>
        ))}

        <div className="flex items-center gap-2">
          <input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder={placeholder}
            aria-label={titulo}
            className={cn(campo("sm"), "w-52")}
          />
          <button
            type="button"
            onClick={adicionar}
            disabled={!rascunho.trim()}
            className={botao("secundario", "sm")}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

export function IdentidadeForm({
  blogId,
  nomeDoBlog,
  dominioProprio,
  initialNames,
  initialDomains,
}: {
  blogId: string;
  nomeDoBlog: string;
  dominioProprio: string | null;
  initialNames: string[];
  initialDomains: string[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [nomes, setNomes] = useState(initialNames);
  const [dominios, setDominios] = useState(initialDomains);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    setErro(null);

    const { error } = await supabase
      .from("blogs")
      .update({ brand_names: nomes, brand_domains: dominios })
      .eq("id", blogId);

    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSalvo(true);
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
      <Lista
        titulo="Como a marca é escrita"
        ajuda={`Toda grafia que uma IA poderia usar: nome comercial, razão social, apelido, com e sem acento. Sem nada aqui, procuramos apenas por "${nomeDoBlog}".`}
        placeholder="DataKnow"
        itens={nomes}
        onChange={setNomes}
      />

      <Lista
        titulo="Domínios da marca"
        ajuda={
          dominioProprio
            ? `Além de ${dominioProprio} e do blog hospedado, que já contam. Adicione domínios antigos, redirecionados ou de outros países.`
            : "Sites que são da marca. Sem domínio próprio configurado, só o blog hospedado conta."
        }
        placeholder="dataknow.es"
        itens={dominios}
        normalizar={(v) =>
          v
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "")
            .replace(/^www\./, "")
        }
        onChange={setDominios}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando}
          className={botao("primario")}
        >
          {salvando ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
        </button>
        {salvo && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Vale a partir da próxima análise do Radar GEO.
          </span>
        )}
      </div>

      {erro && <p className="text-sm text-nota-critico">{erro}</p>}
    </div>
  );
}
