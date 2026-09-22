"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw } from "lucide-react";
import { botao, campo } from "@/components/ui";
import { BotaoSalvar } from "@/components/botao-salvar";
import { cn } from "@/lib/utils";
import { codigoDoWorker, normalizarPasta, passosDaPasta } from "@/lib/pasta";
import type { DomainStatus } from "@/types";

// Blog numa pasta do site do cliente (cliente.com/blog). Como no domínio, a
// conta do Cloudflare é do cliente: o painel entrega o texto pronto, com o
// código do Worker já preenchido, para a agência mandar.

const RESULTADO: Record<DomainStatus, { titulo: string; detalhe: string }> = {
  active: {
    titulo: "No ar",
    detalhe:
      "A pasta já mostra o blog. A partir de agora os links, o sitemap e o endereço oficial dos artigos usam este endereço.",
  },
  pending: {
    titulo: "Ainda sem resposta",
    detalhe:
      "A pasta não respondeu. Confira se o Worker foi publicado (passo 3) e se a rota foi salva (passo 4). Depois de salvar, leva poucos minutos.",
  },
  error: {
    titulo: "Responde, mas não é o blog",
    detalhe:
      "A pasta mostra outra coisa. Normalmente falta a rota do Worker (passo 4) ou a nuvem laranja ligada no DNS do site (passo 1).",
  },
};

export function PublicarNaPasta({
  enderecoInicial,
  statusInicial,
  appOrigin,
}: {
  enderecoInicial: string | null;
  statusInicial: DomainStatus;
  /** Origem do app, que vai dentro do código do Worker. */
  appOrigin: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(enderecoInicial ?? "");
  const [endereco, setEndereco] = useState(enderecoInicial);
  const [status, setStatus] = useState<DomainStatus | null>(
    enderecoInicial ? statusInicial : null,
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [copiado, setCopiado] = useState<"tudo" | "codigo" | null>(null);

  // A mesma validação do servidor, na digitação: o erro aparece antes do
  // clique, e o botão não manda o que a rota vai recusar.
  const previa = texto.trim() ? normalizarPasta(texto) : null;
  const erroNaDigitacao = previa && "erro" in previa ? previa.erro : null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (erroNaDigitacao || salvando) return;
    setSalvando(true);
    setSalvo(false);
    setErro(null);
    const res = await fetch("/api/blog/pasta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endereco: texto }),
    });
    const data = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro(data.error ?? "Não foi possível salvar agora.");
      return;
    }
    setEndereco(data.endereco ?? null);
    setTexto(data.endereco ?? "");
    setStatus(data.endereco ? "pending" : null);
    setSalvo(true);
    router.refresh();
  }

  async function conferir() {
    setConferindo(true);
    const res = await fetch("/api/blog/pasta", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setConferindo(false);
    if (res.ok) {
      setStatus(data.status as DomainStatus);
      router.refresh();
    } else {
      setErro(data.error ?? "Não foi possível conferir agora.");
    }
  }

  const passos = endereco ? passosDaPasta(endereco) : [];
  const codigo = endereco ? codigoDoWorker(endereco, appOrigin) : "";

  async function copiar(oque: "tudo" | "codigo") {
    const conteudo =
      oque === "codigo"
        ? codigo
        : [
            `Como publicar o blog em ${endereco}:`,
            "",
            ...passos.map((p, i) => `${i + 1}. ${p}`),
            "",
            "Código para colar no Worker:",
            "",
            codigo,
            "Qualquer dúvida é só me chamar.",
          ].join("\n");
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopiado(oque);
    } catch {
      setCopiado(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        O blog fica dentro do site do cliente, como <strong>cliente.com/blog</strong>.
        É o formato que mais ajuda o SEO dele: cada artigo soma força ao site
        inteiro. Precisa que o site use o Cloudflare - o plano grátis serve.
        Sites no Wix, Squarespace ou Shopify não permitem; para eles, use o
        subdomínio abaixo.
      </p>

      <form onSubmit={salvar} className="mt-4">
        <label htmlFor="endereco-da-pasta" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Endereço da pasta
        </label>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Exatamente como o site abre, com ou sem www, mais a pasta.
        </p>
        <input
          id="endereco-da-pasta"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setSalvo(false);
          }}
          placeholder="https://cliente.com/blog"
          aria-invalid={!!erroNaDigitacao}
          aria-describedby={erroNaDigitacao ? "erro-da-pasta" : undefined}
          className={cn(campo(), "mt-2 w-full")}
        />
        {erroNaDigitacao && (
          <p id="erro-da-pasta" className="mt-1 text-sm text-nota-critico">
            {erroNaDigitacao}
          </p>
        )}
        <div className="mt-3">
          <BotaoSalvar
            salvando={salvando}
            salvo={salvo}
            disabled={!!erroNaDigitacao || (texto.trim() || null) === endereco}
            rotulo={texto.trim() || !endereco ? "Salvar" : "Remover pasta"}
          />
        </div>
        {erro && <p className="mt-2 text-sm text-nota-critico">{erro}</p>}
      </form>

      {endereco && (
        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A conta do Cloudflare é do cliente, então quem instala é ele.
            Copie e mande - o endereço e o código já vão preenchidos.
          </p>

          <ol className="mt-4 space-y-3">
            {passos.map((passo, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular font-display mt-0.5 shrink-0 text-sm text-slate-500 dark:text-slate-400">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{passo}</span>
              </li>
            ))}
          </ol>

          <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-slate-100 p-3 font-mono text-xs leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <code>{codigo}</code>
          </pre>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => copiar("tudo")} className={botao("secundario", "sm")}>
              {copiado === "tudo" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              <span aria-live="polite">
                {copiado === "tudo" ? "Copiado" : "Copiar para enviar ao cliente"}
              </span>
            </button>
            <button type="button" onClick={() => copiar("codigo")} className={botao("fantasma", "sm")}>
              {copiado === "codigo" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              <span aria-live="polite">{copiado === "codigo" ? "Código copiado" : "Copiar só o código"}</span>
            </button>
            <button
              type="button"
              onClick={conferir}
              disabled={conferindo}
              className={botao("fantasma", "sm")}
            >
              <RefreshCw size={14} aria-hidden className={conferindo ? "animate-spin" : ""} />
              {conferindo ? "Conferindo..." : "Conferir se já está no ar"}
            </button>
          </div>

          {status && (
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {RESULTADO[status].titulo}
              </p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {RESULTADO[status].detalhe}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
