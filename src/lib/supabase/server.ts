import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client para uso em Server Components, Route Handlers e Server Actions.
// Lê/escreve cookies de sessão do Supabase Auth.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chamado a partir de um Server Component - ignorável se houver
            // middleware refrescando a sessão.
          }
        },
      },
    },
  );
}
