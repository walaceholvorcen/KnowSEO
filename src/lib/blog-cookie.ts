// Nome do cookie que guarda o cliente em operação.
//
// Mora num arquivo próprio porque é lido nos dois lados: o servidor
// (workspace.ts, que importa next/headers) e a barra lateral, que é
// componente de cliente. Importar workspace.ts do navegador arrastaria o
// client do Supabase de servidor para o pacote do front.
export const BLOG_COOKIE = "blog_ativo";
