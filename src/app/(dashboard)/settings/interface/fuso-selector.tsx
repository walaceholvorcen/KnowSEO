"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { botao, campo, folha } from "@/components/ui";

const UM_ANO = 60 * 60 * 24 * 365;
const gravar = (nome: string, valor: string, maxAge = UM_ANO) => {
  document.cookie = `${nome}=${encodeURIComponent(valor)}; path=/; max-age=${maxAge}; samesite=lax`;
};

const nuncaMuda = () => () => {};

// A lista vem do servidor (prop) e não de Intl no navegador: Node e navegador
// podem ter versões de ICU com listas diferentes, e o <select> renderizado
// divergiria na hidratação. O "detectado" só aparece depois de montar, porque
// o fuso do navegador não existe no servidor.
export function FusoSelector({
  atual,
  fusos,
  manual,
}: {
  atual: string;
  fusos: string[];
  manual: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(atual);
  // null no servidor e na hidratação; o fuso real logo depois, sem setState
  // dentro de efeito.
  const detectado = useSyncExternalStore(
    nuncaMuda,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );

  const opcoes = fusos.includes(atual) ? fusos : [atual, ...fusos];

  return (
    <div className={folha()}>
      <label htmlFor="fuso" className="text-sm font-medium text-slate-900 dark:text-slate-100">
        Fuso horário
      </label>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {manual
          ? "Escolhido à mão: o painel não troca sozinho quando o navegador muda de fuso."
          : "Detectado pelo navegador. Escolher um aqui desliga a detecção."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          id="fuso"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            gravar("fuso", e.target.value);
            gravar("fuso_manual", "1");
            router.refresh();
          }}
          className={campo()}
        >
          {opcoes.map((f) => (
            <option key={f} value={f}>
              {f === detectado ? `${f} (detectado)` : f}
            </option>
          ))}
        </select>
        {manual && detectado && (
          <button
            type="button"
            className={botao("fantasma")}
            onClick={() => {
              setValor(detectado);
              gravar("fuso", detectado);
              gravar("fuso_manual", "", 0);
              router.refresh();
            }}
          >
            Voltar a detectar
          </button>
        )}
      </div>
    </div>
  );
}
