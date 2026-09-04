import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client com service_role - ignora RLS. Uso restrito a rotas server-only
// que precisam escrever em nome de visitantes anônimos (ex: /api/track)
// ou operações administrativas entre tenants. NUNCA importar em código
// que roda no browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
