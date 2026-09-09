"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function IntegrationsForm({
  conectado,
  blogId,
  gscPropertyAtual,
  ga4PropertyAtual,
}: {
  conectado: boolean;
  blogId: string;
  gscPropertyAtual: string | null;
  ga4PropertyAtual: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [carregandoPropriedades, setCarregandoPropriedades] = useState(false);
  const [gscOpcoes, setGscOpcoes] = useState<string[]>([]);
  const [ga4Opcoes, setGa4Opcoes] = useState<{ id: string; nome: string }[]>([]);
  const [gscProperty, setGscProperty] = useState(gscPropertyAtual ?? "");
  const [ga4Property, setGa4Property] = useState(ga4PropertyAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só busca a lista de propriedades depois de conectado - antes disso a
  // chamada falharia sem token nenhum para usar.
  useEffect(() => {
    if (!conectado) return;

    async function carregar() {
      setCarregandoPropriedades(true);
      try {
        const res = await fetch("/api/integrations/google/properties");
        const data = await res.json();
        setGscOpcoes(data.gsc ?? []);
        setGa4Opcoes(data.ga4 ?? []);
      } catch {
        setErro("Não foi possível listar as propriedades do Google.");
      } finally {
        setCarregandoPropriedades(false);
      }
    }

    carregar();
  }, [conectado]);

  async function salvar() {
    setSalvando(true);
    setErro(null);

    const { error } = await supabase
      .from("blogs")
      .update({
        gsc_property: gscProperty || null,
        ga4_property_id: ga4Property || null,
      })
      .eq("id", blogId);

    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSalvo(true);
    router.refresh();
  }

  if (!conectado) {
    return (
      <a
        href="/api/integrations/google/connect"
        className="inline-block rounded-lg bg-cobalto-600 px-4 py-2 font-semibold text-white hover:bg-cobalto-700"
      >
        Conectar com o Google
      </a>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Propriedade do Search Console
        </label>
        <select
          value={gscProperty}
          onChange={(e) => setGscProperty(e.target.value)}
          disabled={carregandoPropriedades}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
        >
          <option value="">
            {carregandoPropriedades ? "Carregando..." : "Nenhuma selecionada"}
          </option>
          {gscOpcoes.map((url) => (
            <option key={url} value={url}>
              {url}
            </option>
          ))}
        </select>
        {!carregandoPropriedades && gscOpcoes.length === 0 && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Nenhuma propriedade visível. Peça para o cliente adicionar a
            conta conectada como usuário no Search Console dele.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Propriedade do GA4
        </label>
        <select
          value={ga4Property}
          onChange={(e) => setGa4Property(e.target.value)}
          disabled={carregandoPropriedades}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400"
        >
          <option value="">
            {carregandoPropriedades ? "Carregando..." : "Nenhuma selecionada"}
          </option>
          {ga4Opcoes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        {!carregandoPropriedades && ga4Opcoes.length === 0 && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Nenhuma propriedade visível. Peça para o cliente adicionar a
            conta conectada em Administrador → Acesso à propriedade, no GA4.
          </p>
        )}
      </div>

      <button
        onClick={salvar}
        disabled={salvando}
        className="rounded-lg bg-cobalto-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cobalto-700 disabled:opacity-50"
      >
        {salvando ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
      </button>

      {erro && <p className="text-nota-critico">{erro}</p>}
    </div>
  );
}
