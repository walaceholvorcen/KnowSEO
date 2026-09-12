"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { botao, campo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "../traduz-erro";

export default function NovaSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  // Sem sessão, a troca de senha não tem em quem aplicar. Acontece quando o
  // link expirou ou já foi usado - e a tela precisa dizer isso, não falhar
  // em silêncio depois que a pessoa digitou a senha nova.
  const [temSessao, setTemSessao] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setTemSessao(Boolean(data.session)));
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setErro(traduzErroAuth(error.message));
      setCarregando(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (temSessao === false) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Este link não vale mais
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Links de recuperação valem por uma hora e só podem ser usados uma
          vez.
        </p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/esqueci" className="font-medium text-cobalto-600 hover:underline dark:text-cobalto-300">
            Pedir um link novo
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Criar senha nova
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Depois de salvar, você entra direto no painel.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="senha"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Senha nova
          </label>
          <input
            id="senha"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={cn(campo(), "w-full")}
            placeholder="Mínimo de 6 caracteres"
          />
        </div>

        {erro && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando || temSessao === null}
          className={cn(botao("primario"), "w-full")}
        >
          {carregando ? "Salvando..." : "Salvar senha"}
        </button>
      </form>
    </div>
  );
}
