import { NextResponse } from "next/server";
import { requireUserAndWorkspace, completeOnboardingStep } from "@/lib/workspace";
import type { OnboardingSteps } from "@/types";

const VALID_STEPS: (keyof OnboardingSteps)[] = [
  "brand_dna",
  "domain_connected",
  "analytics_connected",
  "first_article_published",
  "site_analyzed",
];

export async function POST(request: Request) {
  const { supabase, workspace } = await requireUserAndWorkspace();
  const { step } = await request.json();

  if (!VALID_STEPS.includes(step)) {
    return NextResponse.json({ error: "invalid step" }, { status: 400 });
  }

  await completeOnboardingStep(supabase, workspace, step);

  return NextResponse.json({ ok: true });
}
