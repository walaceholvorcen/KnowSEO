"use client";

import { useState } from "react";
import { botao } from "@/components/ui";

// Único pedaço com JavaScript do relatório: imprimir e copiar exigem o
// navegador. O resto (período, comparação) é servidor e link.
export function AcoesDoRelatorio({ token }: { token?: string | null }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {token && (
        <button
          type="button"
          className={botao("secundario")}
          onClick={async () => {
            // A origem vem do navegador: é o mesmo endereço em que o painel
            // está aberto, sem depender de variável de domínio.
            await navigator.clipboard.writeText(`${location.origin}/r/${token}`);
            setCopiado(true);
          }}
        >
          <span aria-live="polite">{copiado ? "Link copiado" : "Copiar link para o cliente"}</span>
        </button>
      )}
      {/* Sem biblioteca de PDF: o "Salvar como PDF" da impressão do navegador
          usa a folha print: do próprio relatório. */}
      <button type="button" className={botao("primario")} onClick={() => window.print()}>
        Exportar PDF
      </button>
    </div>
  );
}
