"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "../traduz-erro";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(traduzErroAuth(error.message));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Entrar
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Acesse o painel da sua marca.
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
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Senha
            </label>
            <Link
              href="/esqueci"
              className="text-sm text-cobalto-600 hover:underline dark:text-cobalto-300"
            >
              Esqueci minha senha
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(campo(), "w-full")}
            placeholder="••••••••"
          />
        </div>

        {!error && (
          <Suspense fallback={null}>
            <AvisoDeLinkInvalido />
          </Suspense>
        )}
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
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Ainda não tem conta?{" "}
        <Link
          href="/signup"
          className="font-medium text-cobalto-600 dark:text-cobalto-300 hover:underline"
        >
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}

function AvisoDeLinkInvalido() {
  if (useSearchParams().get("erro") !== "link_invalido") return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    >
      O link de recuperação não vale mais. Peça um novo em &quot;Esqueci minha
      senha&quot;.
    </p>
  );
}
