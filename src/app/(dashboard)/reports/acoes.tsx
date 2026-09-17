"use client";

import { useEffect, useState } from "react";
import { botao } from "@/components/ui";

// Único pedaço com JavaScript do relatório: imprimir e copiar exigem o
// navegador. O resto (período, comparação) é servidor e link.
export function AcoesDoRelatorio({ token }: { token?: string | null }) {
  const [copiado, setCopiado] = useState(false);

  // Papel é branco. Sem isto, quem opera no modo escuro exporta um PDF de
  // fundo preto para mandar ao cliente. Nos eventos do navegador, e não só
  // no clique do botão, para valer também no Ctrl+P.
  useEffect(() => {
    const raiz = document.documentElement;
    let escuro = false;
    const antes = () => {
      escuro = raiz.classList.contains("dark");
      raiz.classList.remove("dark");
    };
    const depois = () => {
      if (escuro) raiz.classList.add("dark");
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
    };
  }, []);

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
