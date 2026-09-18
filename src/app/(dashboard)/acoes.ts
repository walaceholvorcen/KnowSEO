"use server";

import { createClient } from "@/lib/supabase/server";
import { htmlSeguro } from "@/lib/html-seguro";
import { slugify } from "@/lib/utils";
import type { InternalLink } from "@/types";
import { normalizarAutor, type Autor } from "@/lib/autor";

// As gravações que antes o navegador fazia direto no Supabase.
//
// Com o cookie de sessão HttpOnly (revisão de segurança de 17/09, item S1a),
// o navegador não tem mais o token para falar com o banco - tudo passa por
// aqui, com o client de servidor e a sessão de quem está logado. Quem
// garante que o blog é mesmo do workspace continua sendo a RLS: um id de
// outra agência não casa com linha nenhuma, e o update simplesmente não
// acontece. Por isso cada ação confere se alguma linha foi de fato mudada.

type Resultado = { erro: string | null };

const NADA_MUDOU = "Não encontramos este registro na sua conta.";

export async function salvarArtigo(dados: {
  id: string;
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  contentHtml: string;
  publicar: boolean;
  publishedAt: string | null;
}): Promise<Resultado & { slug?: string }> {
  const supabase = await createClient();
  const slug = slugify(dados.slug) || slugify(dados.title);
  const status = dados.publicar ? "published" : "draft";

  const { data, error } = await supabase
    .from("articles")
    .update({
      title: String(dados.title).slice(0, 300),
      slug,
      seo_title: String(dados.seoTitle ?? "").slice(0, 300),
      seo_description: String(dados.seoDescription ?? "").slice(0, 500),
      // O editor é contentEditable: o que chega aqui é o HTML que estava
      // no navegador, e é isso que vai ao ar no blog do cliente.
      content_html: htmlSeguro(dados.contentHtml),
      status,
      // Só a primeira publicação define a data. Sem isto, cada correção
      // num artigo publicado o devolvia ao topo do blog como se fosse novo.
      published_at: dados.publicar
        ? (dados.publishedAt ?? new Date().toISOString())
        : dados.publishedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dados.id)
    .select("id");

  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Já existe outro artigo com esse endereço. Mude o endereço do artigo."
          : error.message,
    };
  }
  if (!data?.length) return { erro: NADA_MUDOU };
  return { erro: null, slug };
}

export async function adicionarLinkInterno(
  blogId: string,
  url: string,
  titulo: string,
): Promise<Resultado & { link?: InternalLink }> {
  // Só http e https: o endereço vira href dentro do artigo gerado.
  let endereco: URL;
  try {
    endereco = new URL(String(url).trim());
  } catch {
    return { erro: "Endereço inválido. Use o endereço completo, com https://." };
  }
  if (endereco.protocol !== "https:" && endereco.protocol !== "http:") {
    return { erro: "Use um endereço que comece com https://." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("internal_links")
    .insert({
      blog_id: blogId,
      url: endereco.toString(),
      title: String(titulo ?? "").trim().slice(0, 200) || null,
    })
    .select()
    .single();
  if (error) return { erro: error.message };
  return { erro: null, link: data as InternalLink };
}

export async function removerLinkInterno(id: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.from("internal_links").delete().eq("id", id);
  return { erro: error?.message ?? null };
}

export async function descartarPauta(id: string): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("keywords")
    .update({ status: "rejected" })
    .eq("id", id);
  return { erro: error?.message ?? null };
}

export async function salvarDnaDaMarca(
  blogId: string,
  dna: {
    description: string;
    target_audience: string;
    tone: string;
    writing_style: string;
    banned_topics: string;
    banned_words: string;
    provas: string;
  },
): Promise<Resultado> {
  const supabase = await createClient();
  const limitar = (v: string) => String(v ?? "").slice(0, 4000);
  const { error } = await supabase.from("brand_dna").upsert({
    blog_id: blogId,
    description: limitar(dna.description),
    target_audience: limitar(dna.target_audience),
    tone: limitar(dna.tone),
    writing_style: limitar(dna.writing_style),
    banned_topics: limitar(dna.banned_topics),
    banned_words: limitar(dna.banned_words),
    provas: limitar(dna.provas),
    updated_at: new Date().toISOString(),
  });
  if (error?.code === "42703" || error?.code === "PGRST204") {
    return { erro: "O campo de dados e casos reais depende da migração 0019 no Supabase." };
  }
  return { erro: error?.message ?? null };
}

export async function salvarIdentidadeDaMarca(
  blogId: string,
  nomes: string[],
  dominios: string[],
): Promise<Resultado> {
  const supabase = await createClient();
  const limpar = (lista: string[]) =>
    (Array.isArray(lista) ? lista : [])
      .map((v) => String(v).trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 30);

  const { data, error } = await supabase
    .from("blogs")
    .update({ brand_names: limpar(nomes), brand_domains: limpar(dominios) })
    .eq("id", blogId)
    .select("id");
  if (error) return { erro: error.message };
  return { erro: data?.length ? null : NADA_MUDOU };
}

export async function salvarIntegracoes(
  blogId: string,
  gscProperty: string,
  ga4PropertyId: string,
): Promise<Resultado> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blogs")
    .update({
      gsc_property: String(gscProperty ?? "").slice(0, 300) || null,
      ga4_property_id: String(ga4PropertyId ?? "").slice(0, 100) || null,
    })
    .eq("id", blogId)
    .select("id");
  if (error) return { erro: error.message };
  return { erro: data?.length ? null : NADA_MUDOU };
}

export async function salvarAutor(
  blogId: string,
  dados: { nome: string; cargo: string; bio: string; perfil: string },
): Promise<Resultado & { autor?: Autor | null }> {
  const r = normalizarAutor(dados);
  if ("erro" in r) return { erro: r.erro };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blogs")
    .update({ autor: r.autor })
    .eq("id", blogId)
    .select("id");
  if (error) {
    // Coluna ausente ou sem permissão = a 0018 ainda não rodou no banco.
    return {
      erro: ["42703", "PGRST204", "42501"].includes(error.code ?? "")
        ? "Salvar o autor depende da migração 0018_autor_do_blog.sql, que ainda não foi aplicada no banco."
        : error.message,
    };
  }
  return data?.length ? { erro: null, autor: r.autor } : { erro: NADA_MUDOU };
}
