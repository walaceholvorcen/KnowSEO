"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";

export function CreateBlogForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [language, setLanguage] = useState<"es" | "pt" | "en">("es");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const finalSubdomain = slugify(subdomain || name);

    const { data: blog, error: insertError } = await supabase
      .from("blogs")
      .insert({
        workspace_id: workspaceId,
        name,
        subdomain: finalSubdomain,
        language,
        // Cor definida aqui (e não pelo default do banco) para novos blogs
        // já nascerem no azul marinho da marca. O cliente pode trocar
        // depois em Configurações > Blog e Domínio.
        theme: {
          primary_color: "#15191c",
          logo_url: null,
          tagline: null,
        },
      })
      .select()
      .single();

    if (insertError || !blog) {
      setError(
        insertError?.message.includes("duplicate")
          ? "Ese subdominio ya está en uso, prueba otro."
          : (insertError?.message ?? "Error al crear el blog"),
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Nombre del blog
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!subdomain) setSubdomain(slugify(e.target.value));
          }}
          className={cn(campo(), "w-full")}
          placeholder="Blog de mi empresa"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Dirección
        </label>
        <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 focus-within:border-cobalto-500 dark:focus-within:border-cobalto-400 focus-within:ring-3 focus-within:ring-cobalto-500/15 dark:focus-within:ring-cobalto-400/20">
          <input
            type="text"
            required
            value={subdomain}
            onChange={(e) => setSubdomain(slugify(e.target.value))}
            className="w-full rounded-l-lg px-3 py-2 text-sm outline-none"
            placeholder="mi-empresa"
          />
          <span className="whitespace-nowrap rounded-r-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
            .{rootDomain}
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Idioma del contenido
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as "es" | "pt" | "en")}
          className={cn(campo(), "w-full")}
        >
          <option value="es">Español</option>
          <option value="pt">Português</option>
          <option value="en">English</option>
        </select>
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
        {loading ? "Creando..." : "Crear blog"}
      </button>
    </form>
  );
}
