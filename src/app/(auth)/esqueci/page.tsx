"use client";

import { useState } from "react";
import Link from "next/link";
import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "../traduz-erro";

export default function EsqueciPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // O link do e-mail cai numa rota nossa que troca o código por sessão
      // antes de mostrar o formulário de nova senha.
      redirectTo: `${window.location.origin}/api/auth/confirmar?destino=/nova-senha`,
    });

    if (error) {
      setErro(traduzErroAuth(error.message));
      setCarregando(false);
      return;
    }

    // Sucesso é sempre a mesma tela, exista ou não a conta: dizer "este
    // e-mail não está cadastrado" entrega ao curioso quem é cliente.
    setEnviado(true);
    setCarregando(false);
  }

  if (enviado) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Confira seu email
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Se existir uma conta com{" "}
          <strong className="text-slate-700 dark:text-slate-300">{email}</strong>
          , enviamos um link para criar uma senha nova. Ele vale por uma hora.
        </p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Não chegou? Procure no spam ou{" "}
          <button
            type="button"
            onClick={() => setEnviado(false)}
            className="font-medium text-cobalto-600 hover:underline dark:text-cobalto-300"
          >
            tente outro email
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Recuperar acesso
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Enviamos um link para você criar uma senha nova.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(campo(), "w-full")}
            placeholder="nome@empresa.com"
          />
        </div>

        {erro && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className={cn(botao("primario"), "w-full")}
        >
          {carregando ? "Enviando..." : "Enviar link"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-cobalto-600 hover:underline dark:text-cobalto-300">
          Entrar
        </Link>
      </p>
    </div>
  );
}
