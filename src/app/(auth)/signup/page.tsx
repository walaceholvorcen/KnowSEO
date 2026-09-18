"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cadastrar } from "@/app/acoes-de-conta";
import { traduzErroAuth } from "../traduz-erro";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Conta e workspace nascem no servidor: o cookie de sessão é HttpOnly e
    // o navegador não fala mais com o Supabase (ver acoes-de-conta.ts).
    const { erro, confirmarEmail } = await cadastrar(name, email, password);

    if (erro) {
      setError(traduzErroAuth(erro));
      setLoading(false);
      return;
    }

    // Confirmação de e-mail ligada no projeto: ainda não há sessão.
    if (confirmarEmail) {
      setNeedsConfirmation(true);
      setLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  if (needsConfirmation) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Confira seu email
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Enviamos um link de confirmação para{" "}
          <strong className="text-slate-700 dark:text-slate-300">
            {email}
          </strong>
          . Abra a mensagem para ativar sua conta.
        </p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Depois de confirmar,{" "}
          <Link
            href="/login"
            className="font-medium text-cobalto-600 dark:text-cobalto-300 hover:underline"
          >
            entre no painel
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Criar conta
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Grátis, sem cartão de crédito.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Seu nome
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(campo(), "w-full")}
            placeholder="Ana Almeida"
          />
        </div>
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
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(campo(), "w-full")}
            placeholder="Mínimo de 6 caracteres"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(botao("primario"), "w-full")}
        >
          {loading ? "Criando conta..." : "Criar conta grátis"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-medium text-cobalto-600 dark:text-cobalto-300 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
