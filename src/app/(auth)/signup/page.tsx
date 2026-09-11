"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { traduzErroAuth } from "../traduz-erro";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
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

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(traduzErroAuth(signUpError.message));
      setLoading(false);
      return;
    }

    // Se a confirmação de email estiver ativada no projeto Supabase, ainda
    // não há sessão - pedimos para o usuário confirmar por email.
    if (!data.session) {
      setNeedsConfirmation(true);
      setLoading(false);
      return;
    }

    // Cria o workspace inicial + vínculo de owner. O id é gerado aqui (e não
    // com .select() depois do insert): a policy de SELECT de "workspaces"
    // exige que o usuário já seja membro, e esse membro só é criado no
    // insert seguinte - pedir a linha de volta antes disso dispara um falso
    // erro de "row-level security policy".
    const workspaceId = crypto.randomUUID();
    const workspaceSlug = `${slugify(name || email.split("@")[0])}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const { error: wsError } = await supabase.from("workspaces").insert({
      id: workspaceId,
      name: name || "Minha conta",
      slug: workspaceSlug,
    });

    if (wsError) {
      setError(traduzErroAuth(wsError.message));
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: data.session.user.id,
        role: "owner",
      });

    if (memberError) {
      setError(traduzErroAuth(memberError.message));
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
