"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

// Autenticação pelo servidor, nunca pelo navegador.
//
// O cookie de sessão do Supabase guarda o refresh token, que renova sozinho
// e vale por meses. Enquanto o navegador falava direto com o Supabase, esse
// cookie precisava ser legível por JavaScript - e qualquer XSS virava roubo
// de conta durável. Com login, cadastro e troca de senha aqui, o cookie
// passa a ser HttpOnly (src/lib/supabase/cookie.ts) e o navegador não toca
// mais no token. Revisão de segurança de 17/09, item S1a.

type Resultado = { erro: string | null };

export async function entrar(email: string, senha: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password: String(senha),
  });
  return { erro: error?.message ?? null };
}

export async function cadastrar(
  nome: string,
  email: string,
  senha: string,
): Promise<Resultado & { confirmarEmail?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim(),
    password: String(senha),
  });
  if (error) return { erro: error.message };

  // Confirmação de e-mail ligada no projeto: ainda não há sessão, e o
  // workspace é criado no primeiro acesso (onboarding/workspace).
  if (!data.session) return { erro: null, confirmarEmail: true };

  return criarWorkspace(nome || String(email).split("@")[0]);
}

// O dono do workspace é quem está na sessão, não um id vindo do formulário:
// o formulário antigo mandava o userId como prop, e a RLS era a única coisa
// impedindo alguém de se vincular ao workspace com o id de outra pessoa.
export async function criarWorkspace(nome: string): Promise<Resultado> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return { erro: "Sessão expirada. Entre de novo." };

  const nomeFinal = String(nome).trim().slice(0, 80) || "Minha conta";
  // O id é gerado aqui (e não com .select() depois do insert): a policy de
  // SELECT de "workspaces" exige que o usuário já seja membro, e esse membro
  // só existe depois do insert seguinte.
  const workspaceId = crypto.randomUUID();
  const slug = `${slugify(nomeFinal)}-${Math.random().toString(36).slice(2, 6)}`;

  const { error: erroWs } = await supabase
    .from("workspaces")
    .insert({ id: workspaceId, name: nomeFinal, slug });
  if (erroWs) return { erro: erroWs.message };

  const { error: erroMembro } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
  return { erro: erroMembro?.message ?? null };
}

export async function pedirNovaSenha(email: string): Promise<Resultado> {
  const supabase = await createClient();
  // A origem vem do pedido, não do formulário: o endereço do link no e-mail
  // não pode ser escolhido por quem preenche o campo. O Supabase ainda
  // confere contra a lista de redirecionamentos permitidos.
  const h = await headers();
  const origem =
    h.get("origin") ??
    `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? h.get("host") ?? ""}`;

  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo: `${origem}/api/auth/confirmar?destino=/nova-senha`,
  });
  return { erro: error?.message ?? null };
}

export async function temSessao(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims.sub);
}

export async function trocarSenha(senha: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: String(senha) });
  return { erro: error?.message ?? null };
}

export async function sair(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
