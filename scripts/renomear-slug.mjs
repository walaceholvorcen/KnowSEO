// Renomeia o slug de um blog com o mesmo comportamento da rota
// PATCH /api/blog/configuracoes: valida o slug novo, recusa colisão, grava o
// antigo em slugs_anteriores (o proxy responde 301 de /b/<antigo>).
// Só funciona depois da migração 0012_slugs_anteriores.sql.
//
// Uso: node scripts/renomear-slug.mjs <antigo> <novo>
import { lerEnv } from "./env.mjs";
import { erroNoSlug, slugsAposRenomear } from "../src/lib/blog-endereco.ts";

const [antigo, novo] = process.argv.slice(2);
if (!antigo || !novo) {
  console.error("Uso: node scripts/renomear-slug.mjs <antigo> <novo>");
  process.exit(1);
}
const erro = erroNoSlug(novo);
if (erro) {
  console.error(`Slug novo inválido: ${erro}`);
  process.exit(1);
}

const { rest } = lerEnv();
const lidos = await (
  await rest(`blogs?select=id,subdomain,slugs_anteriores&subdomain=eq.${encodeURIComponent(antigo)}`)
).json();
if (!Array.isArray(lidos)) {
  console.error(
    lidos.code === "42703"
      ? "A coluna slugs_anteriores não existe: aplique supabase/migrations/0012_slugs_anteriores.sql antes."
      : `Falha ao ler o blog: ${lidos.message}`,
  );
  process.exit(1);
}
if (!lidos.length) {
  console.error(`Nenhum blog com o slug "${antigo}".`);
  process.exit(1);
}
const blog = lidos[0];

const colisao = await (
  await rest(`blogs?select=id&id=neq.${blog.id}&or=(subdomain.eq.${novo},slugs_anteriores.cs.{${novo}})&limit=1`)
).json();
if (!Array.isArray(colisao) || colisao.length) {
  console.error(`"${novo}" já é (ou foi) de outro blog.`);
  process.exit(1);
}

const res = await rest(`blogs?id=eq.${blog.id}`, {
  method: "PATCH",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify({
    subdomain: novo,
    slugs_anteriores: slugsAposRenomear(blog.slugs_anteriores ?? [], antigo, novo),
  }),
});
const salvo = await res.json();
if (!res.ok) {
  console.error(`Falha ao gravar: ${salvo.message}`);
  process.exit(1);
}
console.log(`Renomeado: /b/${antigo} -> /b/${novo}. Anteriores: ${salvo[0].slugs_anteriores.join(", ")}`);
