"use client";

import { useEffect } from "react";

// Ponte entre o editor e a prévia.
//
// O editor está numa janela, a prévia dentro de um iframe. A cada pausa na
// digitação o editor manda título e corpo por postMessage e aqui trocamos
// só esses dois nós - sem recarregar a página, para a rolagem não pular
// de volta ao topo a cada letra digitada.
//
// A moldura (cabeçalho, cor da marca, capa, CTA, tipografia) continua sendo
// a renderizada pelo servidor, com o mesmo componente do blog público: é o
// que garante que a prévia não vira uma imitação com vida própria.
export function LiveBridge({ origin }: { origin: string }) {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Só aceita mensagem da própria origem: um iframe escutando qualquer
      // janela é porta aberta para injeção de HTML de fora.
      if (event.origin !== origin) return;

      const data = event.data as {
        tipo?: string;
        titulo?: string;
        corpo?: string;
      };
      if (data?.tipo !== "knowseo:preview") return;

      const titulo = document.querySelector('[data-preview="titulo"]');
      if (titulo && typeof data.titulo === "string") {
        titulo.textContent = data.titulo;
      }

      const corpo = document.querySelector('[data-preview="corpo"]');
      if (corpo && typeof data.corpo === "string") {
        corpo.innerHTML = data.corpo;
      }
    }

    window.addEventListener("message", onMessage);
    // Avisa o editor que a prévia já montou e pode receber o conteúdo atual.
    window.parent?.postMessage({ tipo: "knowseo:preview-pronta" }, origin);

    return () => window.removeEventListener("message", onMessage);
  }, [origin]);

  return null;
}
