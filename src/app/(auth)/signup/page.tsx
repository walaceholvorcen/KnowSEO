"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";

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
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Si la confirmación de email está activada en el proyecto Supabase,
    // ainda não há sessão - pedimos para o usuário confirmar por email.
    if (!data.session) {
      setNeedsConfirmation(true);
      setLoading(false);
      return;
    }

    // Crea el workspace inicial + membresía de owner. El id se genera acá
    // (no con .select() después del insert): la policy de SELECT de
    // "workspaces" exige que el usuario ya sea miembro, y ese miembro
    // recién se crea en el siguiente insert - pedir la fila de vuelta
    // antes de eso dispara un falso "row-level security policy" error.
    const workspaceId = crypto.randomUUID();
    const workspaceSlug = `${slugify(name || email.split("@")[0])}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const { error: wsError } = await supabase.from("workspaces").insert({
      id: workspaceId,
      name: name || "Mi cuenta",
      slug: workspaceSlug,
    });

    if (wsError) {
      setError(wsError.message);
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
      setError(memberError.message);
      setLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  if (needsConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Confira seu email
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Te enviamos un enlace de confirmación a <strong>{email}</strong>.
            Abra a mensagem para ativar sua conta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Criar conta grátis
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Empieza sin tarjeta de crédito
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tu nombre
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(campo(), "w-full")}
              placeholder="Ana García"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(campo(), "w-full")}
              placeholder="tu@empresa.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(campo(), "w-full")}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(botao("primario"), "w-full")}
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-cobalto-600 dark:text-cobalto-300 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
