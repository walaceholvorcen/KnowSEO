import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { requireUserAndWorkspace, getWorkspaceBlogs } from "@/lib/workspace";
import type { OnboardingSteps } from "@/types";

const STEPS: {
  key: keyof OnboardingSteps;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    key: "brand_dna",
    title: "Define el DNA de tu marca",
    description: "Descripción, tono de voz y público objetivo.",
    href: "/settings/brand",
  },
  {
    key: "domain_connected",
    title: "Conecta tu dominio",
    description: "Usa tu propio dominio en vez del subdominio gratuito.",
    href: "/settings/blog",
  },
  {
    key: "site_analyzed",
    title: "Mapea las páginas de tu sitio",
    description: "Permite enlazado interno automático en los artículos.",
    href: "/settings/blog",
  },
  {
    key: "first_article_published",
    title: "Publica tu primer artículo",
    description: "Genera y publica un artículo con IA.",
    href: "/contents",
  },
  {
    key: "analytics_connected",
    title: "Revisa tus primeras visitas",
    description: "El seguimiento ya está activo desde el primer artículo.",
    href: "/reports",
  },
];

export default async function DashboardHomePage() {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const blogs = await getWorkspaceBlogs(supabase, workspace.id);
  const blog = blogs[0];

  const completed = STEPS.filter(
    (s) => workspace.onboarding_steps[s.key],
  ).length;
  const nextStep = STEPS.find((s) => !workspace.onboarding_steps[s.key]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        Hola 👋
      </h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Blog activo: <strong>{blog?.name}</strong>
      </p>

      {nextStep && (
        <Link
          href={nextStep.href}
          className="mt-6 block rounded-xl border border-cobalto-200 dark:border-cobalto-700 bg-cobalto-50 dark:bg-cobalto-900/40 p-5 transition hover:border-cobalto-300 dark:hover:border-cobalto-600"
        >
          <p className="text-sm text-cobalto-700 dark:text-cobalto-300">
            Próximo paso
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            {nextStep.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {nextStep.description}
          </p>
        </Link>
      )}

      <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Guía de configuración
          </h3>
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {completed} de {STEPS.length} completados
          </span>
        </div>

        <ul className="space-y-3">
          {STEPS.map((step) => {
            const done = workspace.onboarding_steps[step.key];
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-emerald-500 dark:text-emerald-400" />
                  ) : (
                    <Circle size={18} className="text-slate-300 dark:text-slate-600" />
                  )}
                  <span
                    className={
                      done
                        ? "text-sm text-slate-400 dark:text-slate-500 line-through"
                        : "text-sm text-slate-700 dark:text-slate-300"
                    }
                  >
                    {step.title}
                  </span>
                  <span className="ml-auto rounded-full bg-cobalto-100 dark:bg-cobalto-900/60 px-2 py-0.5 text-xs font-medium text-cobalto-700 dark:text-cobalto-300">
                    +1 artículo
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
