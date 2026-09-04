import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sin landing page todavía (a propósito - primero validamos el producto).
// La raíz solo redirige según el estado de sesión.
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
