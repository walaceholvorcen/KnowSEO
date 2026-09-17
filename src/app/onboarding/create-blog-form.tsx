"use client";

import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { erroNoSlug, slugDoNome } from "@/lib/blog-endereco";

export function CreateBlogForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [language, setLanguage] = useState<"es" | "pt" | "en">("es");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // O blog abre em <app>/b/<slug>: subdomínio em .vercel.app morria no TLS.
  const prefixo = `${process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost:3000"}/b/`;
  // Enquanto o slug não foi mexido à mão, ele acompanha o nome do cliente.
  const [slugEditado, setSlugEditado] = useState(false);
  const slugErro = subdomain ? erroNoSlug(subdomain) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const finalSubdomain = subdomain || slugDoNome(name);
    const erro = erroNoSlug(finalSubdomain);
    if (erro) {
      setError(erro);
      setLoading(false);
      return;
    }

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
          ? "Esse endereço já está em uso, tente outro."
          : (insertError?.message ?? "Erro ao criar o blog"),
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
          Nome do blog
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEditado) setSubdomain(slugDoNome(e.target.value));
          }}
          className={cn(campo(), "w-full")}
          placeholder="Blog da minha empresa"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Endereço
        </label>
        <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 focus-within:border-cobalto-500 dark:focus-within:border-cobalto-400 focus-within:ring-3 focus-within:ring-cobalto-500/15 dark:focus-within:ring-cobalto-400/20">
          <span className="whitespace-nowrap rounded-l-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
            {prefixo}
          </span>
          <input
            type="text"
            required
            value={subdomain}
            onChange={(e) => {
              setSlugEditado(true);
              setSubdomain(e.target.value.toLowerCase().trim());
            }}
            aria-invalid={!!slugErro}
            className="w-full min-w-0 rounded-r-lg px-3 py-2 text-sm outline-none"
            placeholder="minha-empresa"
          />
        </div>
        {slugErro && (
          <p className="mt-1 text-xs text-nota-critico">{slugErro}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Idioma do conteúdo
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as "es" | "pt" | "en")}
          className={cn(campo(), "w-full")}
        >
          <option value="es">Espanhol</option>
          <option value="pt">Português</option>
          <option value="en">Inglês</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !!slugErro}
        className={cn(botao("primario"), "w-full")}
      >
        {loading ? "Criando..." : "Criar blog"}
      </button>
    </form>
  );
}
