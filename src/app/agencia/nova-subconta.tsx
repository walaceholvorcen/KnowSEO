"use client";

import { useActionState } from "react";
import { botao, campo, folha } from "@/components/ui";
import { criarSubconta } from "./acoes";

// Um campo só. O resto - blog, domínio, marca - é preenchido dentro da
// subconta, na mesma montagem que qualquer conta nova percorre.
export function NovaSubconta() {
  const [estado, enviar, enviando] = useActionState(criarSubconta, {
    erro: null,
  });

  return (
    <form action={enviar} className={folha()}>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Cada cliente é uma subconta: blog, auditoria, Raio X e cota próprios.
        Depois de criar, você já entra nela para montar o blog.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <label
            htmlFor="nome-da-subconta"
            className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200"
          >
            Nome do cliente
          </label>
          <input
            id="nome-da-subconta"
            name="nome"
            required
            minLength={2}
            maxLength={80}
            autoComplete="off"
            disabled={enviando}
            aria-describedby={estado.erro ? "erro-da-subconta" : undefined}
            className={`${campo()} w-full`}
          />
        </div>
        <button type="submit" disabled={enviando} className={botao("primario")}>
          {enviando ? "Criando..." : "Criar subconta"}
        </button>
      </div>
      {estado.erro && (
        <p id="erro-da-subconta" role="alert" className="text-sm text-nota-critico">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
