"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { botao } from "@/components/ui";
import { ehDominioRaiz } from "@/lib/dominio";
import type { DomainStatus } from "@/types";

// O que o cliente precisa fazer no provedor do domínio dele. Não dá para
// automatizar: o DNS é da empresa dele, e ninguém entrega esse acesso. Então
// o painel entrega o texto pronto para mandar, com o domínio já preenchido -
// é isso que a agência precisa ter na mão, não uma explicação de DNS.
const ALVO_CNAME = "cname.vercel-dns.com";

function passoAPasso(dominio: string) {
  const [sub, ...resto] = dominio.split(".");
  const raiz = resto.join(".");
  return [
    `Entre no painel onde o domínio ${raiz} foi comprado (GoDaddy, Hostinger, Registro.br, Cloudflare, Squarespace...) e abra a área de DNS, também chamada de "Gerenciar DNS" ou "Zona DNS".`,
    `Crie um registro novo com estes três valores:\n   Tipo: CNAME\n   Nome (ou Host): ${sub}\n   Aponta para (ou Valor): ${ALVO_CNAME}`,
    `Se o campo TTL aparecer, deixe o valor automático ou 3600. Salve.`,
    `Pronto. O endereço ${dominio} começa a responder entre 10 minutos e algumas horas, sem tirar nada do site atual: só esse subdomínio passa a ser o blog.`,
  ];
}

const RESULTADO: Record<DomainStatus, { titulo: string; detalhe: string }> = {
  active: {
    titulo: "No ar",
    detalhe: "O endereço já responde com o blog. Não precisa fazer mais nada.",
  },
  pending: {
    titulo: "Ainda sem resposta",
    detalhe:
      "O endereço não respondeu. Ou o CNAME ainda não foi criado, ou está propagando - pode levar até algumas horas. Confira de novo mais tarde.",
  },
  error: {
    titulo: "Responde, mas não é o blog",
    detalhe:
      "Existe alguma coisa nesse endereço que não é o blog. Normalmente falta liberar o domínio do nosso lado: adicione-o no projeto da Vercel, em Settings, Domains.",
  },
};

export function PublicarNoDominio({
  dominio,
  statusInicial,
}: {
  dominio: string | null;
  statusInicial: DomainStatus;
}) {
  const [status, setStatus] = useState<DomainStatus | null>(
    dominio ? statusInicial : null,
  );
  const [conferindo, setConferindo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Domínio raiz salvo no campo acima significaria trocar o site do cliente
  // pelo blog. O que ele quer é o blog DENTRO do site: um subdomínio.
  const raizSalva = dominio ? ehDominioRaiz(dominio) : false;
  const alvo = dominio ? (raizSalva ? `blog.${dominio}` : dominio) : "blog.suaempresa.com";
  const passos = passoAPasso(alvo);

  async function copiar() {
    const texto = [
      `Como publicar o blog em ${alvo}:`,
      "",
      ...passos.map((p, i) => `${i + 1}. ${p}`),
      "",
      "Qualquer dúvida é só me chamar.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  async function conferir() {
    setConferindo(true);
    const res = await fetch("/api/blog/verificar-dominio", { method: "POST" });
    const data = await res.json();
    setConferindo(false);
    if (res.ok) setStatus(data.status as DomainStatus);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        O acesso ao domínio é do cliente, então quem cria o registro é ele.
        Copie o passo a passo abaixo e mande - o endereço já vai preenchido.
        {!dominio && " Salve o domínio próprio acima para o texto sair certo."}
      </p>

      {raizSalva && (
        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          O campo acima está com <strong>{dominio}</strong>, que é o endereço
          principal do site. Publicar o blog nele substituiria o site do
          cliente. O passo a passo abaixo usa <strong>{alvo}</strong> - troque
          o campo acima para esse endereço e salve antes de enviar.
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {passos.map((passo, i) => (
          <li key={i} className="flex gap-3">
            <span className="tabular font-display mt-0.5 shrink-0 text-sm text-slate-400 dark:text-slate-500">
              {i + 1}
            </span>
            <span className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
              {passo}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copiar} className={botao("secundario", "sm")}>
          {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          <span aria-live="polite">
            {copiado ? "Copiado" : "Copiar para enviar ao cliente"}
          </span>
        </button>

        {dominio && (
          <button
            type="button"
            onClick={conferir}
            disabled={conferindo}
            className={botao("fantasma", "sm")}
          >
            <RefreshCw size={14} aria-hidden className={conferindo ? "animate-spin" : ""} />
            {conferindo ? "Conferindo..." : "Conferir se já está no ar"}
          </button>
        )}
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
  );
}
