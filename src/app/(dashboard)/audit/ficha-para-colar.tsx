"use client";

import { useId, useState } from "react";
import { Check, Copy } from "lucide-react";
import { botao, campo } from "@/components/ui";
import {
  blocoJsonLd,
  completarFicha,
  MARCA_FICHA,
  type Complemento,
} from "@/lib/audit/entidade";

/** Separa o texto do "como corrigir" do bloco JSON-LD que a auditoria anexa
 *  aos achados de entidade. Auditoria antiga não tem bloco: devolve null. */
export function separarFicha(fix: string): {
  texto: string;
  ficha: Record<string, unknown> | null;
} {
  const i = fix.indexOf(MARCA_FICHA);
  if (i < 0) return { texto: fix, ficha: null };
  try {
    const json = fix.slice(i + MARCA_FICHA.length).replace(/<\/script>\s*$/, "");
    return { texto: fix.slice(0, i).trim(), ficha: JSON.parse(json) };
  } catch {
    return { texto: fix.slice(0, i).trim(), ficha: null };
  }
}

const vazio = (v: unknown) => v === undefined || v === null || v === "";

export function FichaParaColar({ ficha }: { ficha: Record<string, unknown> }) {
  const id = useId();
  const achados = Array.isArray(ficha.sameAs) ? (ficha.sameAs as string[]) : [];
  const [c, setC] = useState<Complemento>({ perfis: achados });
  const [copiado, setCopiado] = useState(false);

  // Só pede o que o site não disse. Campo que já existe no bloco não aparece:
  // o dado publicado vence o digitado.
  const pede = {
    nome: vazio(ficha.name),
    logo: vazio(ficha.logo) && vazio(ficha.image),
    telefone: vazio(ficha.telephone),
    endereco: vazio(ficha.address),
  };

  const perfisValidos = c.perfis.filter((p) => /^https?:\/\//i.test(p.trim()));
  const ignorados = c.perfis.filter((p) => p.trim() && !/^https?:\/\//i.test(p.trim()));
  const bloco = blocoJsonLd(completarFicha(ficha, c));

  const mudar = (chave: keyof Complemento) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setCopiado(false);
      setC((atual) => ({
        ...atual,
        [chave]: chave === "perfis" ? e.target.value.split("\n") : e.target.value,
      }));
    };

  async function copiar() {
    try {
      await navigator.clipboard.writeText(bloco);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  const rotulo = "block text-sm text-slate-600 dark:text-slate-400";

  return (
    <div className="space-y-4">
      <p className="text-slate-700 dark:text-slate-300">
        Montamos o bloco a partir do que o seu site já publica. Complete o que
        falta, copie e cole no <code className="font-mono text-xs">&lt;head&gt;</code>{" "}
        da página inicial, no lugar do bloco atual. Quem cuida do site faz isso
        em cinco minutos.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2" htmlFor={`${id}-perfis`}>
          <span className={rotulo}>
            Perfis oficiais da empresa, um endereço por linha
          </span>
          <textarea
            id={`${id}-perfis`}
            rows={4}
            value={c.perfis.join("\n")}
            onChange={mudar("perfis")}
            placeholder={"https://www.instagram.com/suaempresa\nhttps://www.linkedin.com/company/suaempresa"}
            className={`${campo()} mt-1 w-full font-mono text-xs`}
          />
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            {achados.length
              ? `${achados.length} ${achados.length === 1 ? "achado" : "achados"} no próprio site. Confira se são da empresa. `
              : "Não achamos link para perfil no HTML do site. "}
            Vale também o perfil no Google e diretórios do setor.
            {ignorados.length > 0 &&
              ` ${ignorados.length} ${ignorados.length === 1 ? "linha fica" : "linhas ficam"} de fora por não começar com https://.`}
          </span>
        </label>

        {pede.nome && (
          <label htmlFor={`${id}-nome`}>
            <span className={rotulo}>Nome da empresa</span>
            <input id={`${id}-nome`} value={c.nome ?? ""} onChange={mudar("nome")} className={`${campo()} mt-1 w-full`} />
          </label>
        )}
        {pede.logo && (
          <label htmlFor={`${id}-logo`}>
            <span className={rotulo}>Endereço da imagem do logo</span>
            <input id={`${id}-logo`} type="url" inputMode="url" value={c.logo ?? ""} onChange={mudar("logo")} placeholder="https://" className={`${campo()} mt-1 w-full`} />
          </label>
        )}
        {pede.telefone && (
          <label htmlFor={`${id}-tel`}>
            <span className={rotulo}>Telefone, com código do país</span>
            <input id={`${id}-tel`} type="tel" value={c.telefone ?? ""} onChange={mudar("telefone")} placeholder="+34 600 000 000" className={`${campo()} mt-1 w-full`} />
          </label>
        )}
        {pede.endereco && (
          <>
            <label htmlFor={`${id}-rua`}>
              <span className={rotulo}>Rua e número</span>
              <input id={`${id}-rua`} autoComplete="street-address" value={c.rua ?? ""} onChange={mudar("rua")} className={`${campo()} mt-1 w-full`} />
            </label>
            <label htmlFor={`${id}-cidade`}>
              <span className={rotulo}>Cidade</span>
              <input id={`${id}-cidade`} autoComplete="address-level2" value={c.cidade ?? ""} onChange={mudar("cidade")} className={`${campo()} mt-1 w-full`} />
            </label>
            <label htmlFor={`${id}-cep`}>
              <span className={rotulo}>Código postal</span>
              <input id={`${id}-cep`} autoComplete="postal-code" value={c.cep ?? ""} onChange={mudar("cep")} className={`${campo()} mt-1 w-full`} />
            </label>
            <label htmlFor={`${id}-pais`}>
              <span className={rotulo}>País, em duas letras</span>
              <input id={`${id}-pais`} autoComplete="country" maxLength={2} value={c.pais ?? ""} onChange={mudar("pais")} placeholder="ES" className={`${campo()} mt-1 w-full uppercase`} />
            </label>
          </>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {perfisValidos.length
              ? `${perfisValidos.length} ${perfisValidos.length === 1 ? "perfil ligado" : "perfis ligados"}`
              : "Sem perfis ligados ainda"}
          </span>
          <div className="flex items-center gap-2">
            <a
              href="https://validator.schema.org/"
              target="_blank"
              rel="noopener noreferrer"
              className={botao("fantasma", "sm")}
            >
              Validar
            </a>
            <button type="button" onClick={copiar} className={botao("secundario", "sm")}>
              {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              <span aria-live="polite">{copiado ? "Copiado" : "Copiar bloco"}</span>
            </button>
          </div>
        </div>
        <pre className="max-h-80 overflow-auto p-3 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
          {bloco}
        </pre>
      </div>
    </div>
  );
}
