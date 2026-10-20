import { notFound } from "next/navigation";
import { auditSite } from "@/lib/audit/runner";

// Dev only: roda o motor real da auditoria sem gravar nada.
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") notFound();
  const url = new URL(req.url).searchParams.get("url") ?? "";
  const r = await auditSite(url);
  return Response.json(r);
}
