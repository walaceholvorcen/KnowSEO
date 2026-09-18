// Teste de isolamento entre agências. Revisão de segurança de 17/09, S6.
//
//   node scripts/isolamento.mjs
//
// Cria duas contas descartáveis (A e B), monta um workspace completo para
// cada uma e tenta, logado como B, ler, alterar, apagar e se infiltrar nos
// dados de A - direto na API do banco, que é onde a RLS decide. Tenta também
// sem login nenhum (chave anon). No fim apaga tudo o que criou, passe ou não.
//
// Sai com código 1 se qualquer tentativa funcionar. É a regressão silenciosa
// mais cara de um SaaS com várias agências: rode depois de qualquer
// migração que mexa em policy.
//
// Usa NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e
// SUPABASE_SERVICE_ROLE_KEY do .env.local. Opcional: APP_URL para conferir
// também a capa de rascunho (/api/og) no app publicado.
import { lerEnv } from "./env.mjs";

const { env } = lerEnv();
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICO = env.SUPABASE_SERVICE_ROLE_KEY;
// O .env.local aponta o app para a máquina local; o teste existe para
// conferir produção. APP_URL no ambiente escolhe outro endereço.
const dominio = env.NEXT_PUBLIC_APP_DOMAIN ?? "";
const APP_URL =
  env.APP_URL ??
  (!dominio || dominio.startsWith("localhost")
    ? "https://know-seo.vercel.app"
    : `https://${dominio}`);
if (!ANON) throw new Error("falta NEXT_PUBLIC_SUPABASE_ANON_KEY");

const sufixo = Math.random().toString(36).slice(2, 8);
const resultados = [];

function registrar(nome, passou, detalhe = "") {
  resultados.push({ nome, passou, detalhe });
  console.log(`${passou ? "ok   " : "FALHA"}  ${nome}${detalhe ? `  (${detalhe})` : ""}`);
}

async function api(caminho, { token = ANON, chave = ANON, ...init } = {}) {
  const r = await fetch(`${URL_SB}${caminho}`, {
    ...init,
    headers: {
      apikey: chave,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  const texto = await r.text();
  let corpo = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }
  return { status: r.status, corpo };
}

const admin = (caminho, init = {}) => api(caminho, { ...init, token: SERVICO, chave: SERVICO });
const linhas = (r) => (Array.isArray(r.corpo) ? r.corpo.length : 0);

async function criarConta(letra) {
  const email = `isolamento-${letra}-${sufixo}@knowseo.test`;
  const senha = `Iso-${crypto.randomUUID()}`;
  const r = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: senha, email_confirm: true }),
  });
  if (r.status >= 300) throw new Error(`criar conta ${letra}: ${JSON.stringify(r.corpo)}`);
  const login = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password: senha }),
  });
  if (!login.corpo?.access_token) throw new Error(`login ${letra}: ${JSON.stringify(login.corpo)}`);
  return { id: r.corpo.id, token: login.corpo.access_token };
}

// O mesmo caminho do cadastro real: workspace, vínculo, blog e o conteúdo
// que uma agência tem - tudo com o token do próprio usuário.
async function montarAgencia(letra, conta) {
  const t = { token: conta.token };
  const ws = crypto.randomUUID();
  const passos = [
    ["/rest/v1/workspaces", { id: ws, name: `Isolamento ${letra}`, slug: `iso-${letra}-${sufixo}` }],
    ["/rest/v1/workspace_members", { workspace_id: ws, user_id: conta.id, role: "owner" }],
  ];
  for (const [caminho, corpo] of passos) {
    const r = await api(caminho, { ...t, method: "POST", body: JSON.stringify(corpo), headers: { Prefer: "return=minimal" } });
    if (r.status >= 300) throw new Error(`${letra} ${caminho}: ${JSON.stringify(r.corpo)}`);
  }
  const blog = await api("/rest/v1/blogs", {
    ...t,
    method: "POST",
    body: JSON.stringify({ workspace_id: ws, name: `Iso ${letra}`, subdomain: `iso-${letra}-${sufixo}` }),
  });
  if (blog.status >= 300) throw new Error(`${letra} blog: ${JSON.stringify(blog.corpo)}`);
  const blogId = blog.corpo[0].id;

  const criar = async (tabela, corpo) => {
    const r = await api(`/rest/v1/${tabela}`, { ...t, method: "POST", body: JSON.stringify(corpo) });
    if (r.status >= 300) throw new Error(`${letra} ${tabela}: ${JSON.stringify(r.corpo)}`);
    return r.corpo[0];
  };
  const artigo = await criar("articles", { blog_id: blogId, title: "Rascunho privado", slug: `rascunho-${sufixo}` });
  const pauta = await criar("keywords", { blog_id: blogId, keyword: `pauta secreta ${sufixo}` });
  await criar("brand_dna", { blog_id: blogId, description: "DNA privado" });
  const link = await criar("internal_links", { blog_id: blogId, url: "https://exemplo.test/privado" });
  return { ws, blogId, artigoId: artigo.id, pautaId: pauta.id, linkId: link.id };
}

async function limpar(contas, agencias) {
  for (const a of agencias) if (a) await admin(`/rest/v1/workspaces?id=eq.${a.ws}`, { method: "DELETE" });
  for (const c of contas) if (c) await admin(`/auth/v1/admin/users/${c.id}`, { method: "DELETE" });
}

const contas = [];
const agencias = [];
try {
  const contaA = await criarConta("a");
  contas.push(contaA);
  const contaB = await criarConta("b");
  contas.push(contaB);
  const A = await montarAgencia("a", contaA);
  agencias.push(A);
  const B = await montarAgencia("b", contaB);
  agencias.push(B);
  const comoB = { token: contaB.token };

  console.log("\nLogado como B, contra os dados de A:\n");

  const leituras = [
    ["workspaces", `id=eq.${A.ws}`],
    ["workspace_members", `workspace_id=eq.${A.ws}`],
    ["blogs", `id=eq.${A.blogId}`],
    ["articles", `id=eq.${A.artigoId}`],
    ["keywords", `id=eq.${A.pautaId}`],
    ["brand_dna", `blog_id=eq.${A.blogId}`],
    ["internal_links", `id=eq.${A.linkId}`],
  ];
  for (const [tabela, filtro] of leituras) {
    const r = await api(`/rest/v1/${tabela}?${filtro}`, comoB);
    registrar(`B não lê ${tabela} de A`, linhas(r) === 0, `${linhas(r)} linhas`);
  }

  const alteracoes = [
    ["articles", `id=eq.${A.artigoId}`, { title: "alterado por B" }],
    ["blogs", `id=eq.${A.blogId}`, { name: "alterado por B" }],
    ["brand_dna", `blog_id=eq.${A.blogId}`, { description: "alterado por B" }],
    ["keywords", `id=eq.${A.pautaId}`, { status: "rejected" }],
  ];
  for (const [tabela, filtro, corpo] of alteracoes) {
    const r = await api(`/rest/v1/${tabela}?${filtro}`, { ...comoB, method: "PATCH", body: JSON.stringify(corpo) });
    registrar(`B não altera ${tabela} de A`, linhas(r) === 0, `status ${r.status}, ${linhas(r)} linhas`);
  }

  for (const [tabela, filtro] of [["keywords", `id=eq.${A.pautaId}`], ["internal_links", `id=eq.${A.linkId}`], ["articles", `id=eq.${A.artigoId}`]]) {
    const r = await api(`/rest/v1/${tabela}?${filtro}`, { ...comoB, method: "DELETE" });
    registrar(`B não apaga ${tabela} de A`, linhas(r) === 0, `status ${r.status}, ${linhas(r)} linhas`);
  }

  {
    const r = await api("/rest/v1/articles", {
      ...comoB,
      method: "POST",
      body: JSON.stringify({ blog_id: A.blogId, title: "plantado por B", slug: `plantado-${sufixo}` }),
    });
    registrar("B não cria artigo no blog de A", r.status >= 400, `status ${r.status}`);
  }

  // A porta que a 0015 fechou: vincular-se como dono ao workspace alheio.
  {
    const r = await api("/rest/v1/workspace_members", {
      ...comoB,
      method: "POST",
      body: JSON.stringify({ workspace_id: A.ws, user_id: contaB.id, role: "owner" }),
    });
    registrar("B não entra no workspace de A", r.status >= 400, `status ${r.status}`);
  }

  // Conferência de que nada de A mudou de verdade, lida pelo serviço.
  {
    const r = await admin(`/rest/v1/articles?id=eq.${A.artigoId}&select=title`);
    registrar("artigo de A intacto", r.corpo?.[0]?.title === "Rascunho privado", r.corpo?.[0]?.title ?? "sumiu");
  }

  // Migração 0016: conta nova nasce em liberação e não se libera sozinha -
  // nem mudando a própria conta, nem já nascendo liberada.
  console.log("\nLiberação de conta (logado como A, na própria conta):\n");
  {
    const antes = await admin(`/rest/v1/workspaces?id=eq.${A.ws}&select=liberado`);
    registrar("conta nova nasce em liberação", antes.corpo?.[0]?.liberado === false, `liberado = ${antes.corpo?.[0]?.liberado}`);

    const r = await api(`/rest/v1/workspaces?id=eq.${A.ws}`, {
      token: contaA.token,
      method: "PATCH",
      body: JSON.stringify({ liberado: true }),
    });
    const depois = await admin(`/rest/v1/workspaces?id=eq.${A.ws}&select=liberado`);
    registrar("A não se libera sozinha", depois.corpo?.[0]?.liberado === false, `status ${r.status}`);

    const extra = crypto.randomUUID();
    const nascer = await api("/rest/v1/workspaces", {
      token: contaA.token,
      method: "POST",
      body: JSON.stringify({ id: extra, name: "já liberada", slug: `iso-lib-${sufixo}`, liberado: true }),
      headers: { Prefer: "return=minimal" },
    });
    registrar("conta não nasce já liberada", nascer.status >= 400, `status ${nascer.status}`);
    await admin(`/rest/v1/workspaces?id=eq.${extra}`, { method: "DELETE" });
  }

  console.log("\nSem login (chave anon):\n");
  for (const tabela of ["blogs", "articles", "workspaces", "workspace_members", "keywords", "brand_dna", "google_integration"]) {
    const r = await api(`/rest/v1/${tabela}?select=*&limit=5`);
    registrar(`anon não lista ${tabela}`, linhas(r) === 0, `${linhas(r)} linhas`);
  }

  console.log(`\nNo app (${APP_URL}):\n`);
  try {
    const r = await fetch(`${APP_URL}/api/og/${A.artigoId}`);
    registrar("capa de rascunho não sai sem login", r.status === 404, `status ${r.status}`);
  } catch {
    // App fora do ar não é furo de isolamento: diz isso numa linha própria,
    // sem misturar com a montagem do teste.
    registrar("capa de rascunho não sai sem login", false, `app não respondeu em ${APP_URL}`);
  }
} catch (erro) {
  registrar("montagem do teste", false, erro.message);
} finally {
  await limpar(contas, agencias);
}

const falhas = resultados.filter((r) => !r.passou);
console.log(`\n${resultados.length - falhas.length} de ${resultados.length} passaram.`);
process.exit(falhas.length ? 1 : 0);
