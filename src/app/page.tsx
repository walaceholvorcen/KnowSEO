import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sem landing page ainda (de propósito - primeiro validamos o produto).
// A raiz só redireciona conforme o estado de sessão.
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
