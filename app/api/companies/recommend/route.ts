import { NextResponse } from "next/server";
import { requireUser, apiError } from "@/lib/auth";
import { companiesSchema } from "@/lib/schemas";
import { structured } from "@/lib/openai";
import { companiesPrompt } from "@/lib/prompts";
import { allowAiRequest } from "@/lib/rate-limit";
export const runtime = "nodejs";

const normaliseCompanyName = (name: string) => name
  .toLocaleLowerCase("en-GB")
  .replace(/\b(plc|ltd|limited|llp|inc|corp|corporation|group)\b/g, "")
  .replace(/[^a-z0-9]/g, "")
  .trim();

export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const [{ data: profile }, { data: cv }, { data: existing, error: existingError }] = await Promise.all([
      auth.pb.from("profiles").select("preferences").eq("id", auth.user.id).single(),
      auth.pb.from("cv_profiles").select("structured").eq("is_default", true).maybeSingle(),
      auth.pb.from("company_targets").select("id, name, status").eq("user_id", auth.user.id),
    ]);
    if (existingError) throw existingError;
    if (!cv?.structured) throw new Error("Add and select a default CV first.");
    if (!allowAiRequest(auth.user.id)) return NextResponse.json({ error: "Daily AI generation limit reached." }, { status: 429 });

    const generated = await structured(companiesSchema, companiesPrompt(cv.structured, profile?.preferences || {}));
    const existingCompanies = (existing || []) as Array<{ id: string; name: string; status?: string }>;
    const existingByName = new Map(existingCompanies.map((company) => [normaliseCompanyName(company.name), company]));
    const uniqueGenerated = Array.from(new Map(generated
      .map((company) => ({ ...company, name: company.name.trim() }))
      .filter((company) => company.name && normaliseCompanyName(company.name))
      .map((company) => [normaliseCompanyName(company.name), company]))
      .values());

    const newCompanies = uniqueGenerated.filter((company) => !existingByName.has(normaliseCompanyName(company.name)));
    const suggestedExisting = uniqueGenerated.filter((company) => existingByName.get(normaliseCompanyName(company.name))?.status === "suggested");
    const preserved = uniqueGenerated.length - newCompanies.length - suggestedExisting.length;

    let created: unknown[] = [];
    if (newCompanies.length) {
      const { data, error } = await auth.pb.from("company_targets")
        .insert(newCompanies.map((company) => ({ ...company, status: "suggested", user_id: auth.user.id })))
        .select();
      if (error) throw error;
      created = data || [];
    }

    const refreshed = await Promise.all(suggestedExisting.map(async (company) => {
      const existingCompany = existingByName.get(normaliseCompanyName(company.name));
      if (!existingCompany) return null;
      const { data, error } = await auth.pb.from("company_targets")
        .update({ industry: company.industry, fit_score: company.fit_score, why_match: company.why_match, roles_query: company.roles_query })
        .eq("id", existingCompany.id)
        .eq("user_id", auth.user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }));

    return NextResponse.json({
      companies: [...created, ...refreshed.filter(Boolean)],
      summary: { created: created.length, refreshed: refreshed.filter(Boolean).length, preserved },
    });
  } catch (error) {
    return apiError(error);
  }
}
