"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";

export function CreateWorkspaceForm({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const finalName = name || userEmail.split("@")[0] || "Mi cuenta";
    const workspaceId = crypto.randomUUID();
    const workspaceSlug = `${slugify(finalName)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    // Sin .select() acá a propósito: la policy de SELECT de "workspaces"
    // exige membresía, que recién se crea en el insert de abajo.
    const { error: wsError } = await supabase.from("workspaces").insert({
      id: workspaceId,
      name: finalName,
      slug: workspaceSlug,
    });

    if (wsError) {
      setError(wsError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Nombre del espacio de trabajo
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-cobalto-500 dark:focus:border-cobalto-400 focus:ring-1 focus:ring-cobalto-500 dark:focus:ring-cobalto-400"
          placeholder="Mi agencia / Mi empresa"
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
        className="w-full rounded-lg bg-cobalto-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalto-700 disabled:opacity-50"
      >
        {loading ? "Creando..." : "Continuar"}
      </button>
    </form>
  );
}
