"use client";

import { botao, campo, folha } from "@/components/ui";
import { BotaoSalvar } from "@/components/botao-salvar";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarIntegracoes } from "../../acoes";

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

  const [carregandoPropriedades, setCarregandoPropriedades] = useState(false);
  const [gscOpcoes, setGscOpcoes] = useState<string[]>([]);
  const [ga4Opcoes, setGa4Opcoes] = useState<{ id: string; nome: string }[]>([]);
  const [gscProperty, setGscProperty] = useState(gscPropertyAtual ?? "");
  const [ga4Property, setGa4Property] = useState(ga4PropertyAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [desconectando, setDesconectando] = useState(false);

  async function desconectar() {
    if (!window.confirm("Desconectar a conta Google deste workspace?")) return;

    setDesconectando(true);
    const res = await fetch("/api/integrations/google/disconnect", {
      method: "POST",
    });
    setDesconectando(false);

    if (!res.ok) {
      setErro("Não foi possível desconectar. Tente de novo.");
      return;
    }
    router.refresh();
  }

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
    setSalvo(false);
    setErro(null);

    const { erro: falha } = await salvarIntegracoes(blogId, gscProperty, ga4Property);

    setSalvando(false);
    if (falha) {
      setErro(falha);
      return;
    }
    setSalvo(true);
    router.refresh();
  }

  if (!conectado) {
    return (
      <a
        href="/api/integrations/google/connect"
        className={botao("primario")}
      >
        Conectar com o Google
      </a>
    );
  }

  return (
    <div className={folha()}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Propriedade do Search Console
        </label>
        <select
          value={gscProperty}
          onChange={(e) => setGscProperty(e.target.value)}
          disabled={carregandoPropriedades}
          className={cn(campo(), "w-full")}
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
            Nenhuma propriedade visível. Ou o site ainda não foi adicionado
            ao Search Console por ninguém, ou está sob outra conta Google —
            nesse caso, quem administra precisa entrar em Configurações →
            Usuários e permissões e adicionar a conta conectada aqui.
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
          className={cn(campo(), "w-full")}
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

      <BotaoSalvar salvando={salvando} salvo={salvo} onClick={salvar}>
        <button
          type="button"
          onClick={desconectar}
          disabled={desconectando}
          className="ml-auto text-sm text-slate-500 dark:text-slate-400 hover:text-nota-critico disabled:opacity-50"
        >
          {desconectando ? "Desconectando..." : "Desconectar conta"}
        </button>
      </BotaoSalvar>

      {erro && <p className="text-nota-critico">{erro}</p>}
    </div>
  );
}
