import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";
import { coverLetterPrompt } from "@/lib/prompts";
import { allowAiRequest } from "@/lib/rate-limit";
import { coverLetterSchema } from "@/lib/schemas";
import { structured } from "@/lib/openai";
import { assertCoverLetterEvidence, normaliseStructured } from "@/lib/cv-context";

export const runtime = "nodejs";

const schema = z.object({ applicationId: z.string().uuid(), coverLetter: z.string().max(10000).optional() });

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const body = schema.parse(await request.json());
    const [{ data: application }, { data: profile }] = await Promise.all([
      auth.supabase.from("applications").select("*,job:jobs(*),cv:cv_profiles(*)").eq("id", body.applicationId).eq("user_id", auth.user.id).single(),
      auth.supabase.from("profiles").select("full_name,headline,location,links").eq("id", auth.user.id).maybeSingle(),
    ]);
    if (!application?.cv?.structured || !application.job) throw new Error("Application CV or job is missing.");

    let coverLetter = body.coverLetter;
    if (!coverLetter) {
      if (!allowAiRequest(auth.user.id)) return NextResponse.json({ error: "Daily AI generation limit reached." }, { status: 429 });
      const cv = normaliseStructured(application.cv.structured);
      let result: z.infer<typeof coverLetterSchema> | undefined;
      let evidenceError: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        const candidate = await structured(coverLetterSchema, coverLetterPrompt(cv, application.job, profile || {}), "gpt-4o");
        try {
          assertCoverLetterEvidence(candidate, cv, application.cv.raw_text);
          result = candidate;
          break;
        } catch (error) {
          evidenceError = error;
        }
      }
      if (!result) throw evidenceError || new Error("The cover letter could not be verified against your CV.");
      coverLetter = result.letter;
    }

    const { data: existing } = await auth.supabase.from("application_kits").select("id").eq("application_id", body.applicationId).eq("user_id", auth.user.id).maybeSingle();
    const query = existing
      ? auth.supabase.from("application_kits").update({ cover_letter: coverLetter, model: "gpt-4o" }).eq("id", existing.id).eq("user_id", auth.user.id)
      : auth.supabase.from("application_kits").insert({ user_id: auth.user.id, application_id: body.applicationId, cv_profile_id: application.cv.id, input_hash: "pending-kit", model: "gpt-4o", cover_letter: coverLetter });
    const { data, error } = await query.select().single();
    if (error) throw error;
    return NextResponse.json({ kit: data });
  } catch (error) {
    return apiError(error);
  }
}
