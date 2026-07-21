import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";
import { autoAnswersSchema } from "@/lib/schemas";
import { structured } from "@/lib/openai";
import { allowAiRequest } from "@/lib/rate-limit";
import { assertAnswerEvidence, normaliseStructured } from "@/lib/cv-context";

export const runtime = "nodejs";
const schema = z.object({ applicationId: z.string().uuid(), questions: z.array(z.string().min(3).max(500)).min(1).max(8) });

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { applicationId, questions } = schema.parse(await request.json());
    const { data: app } = await auth.supabase.from("applications").select("*,job:jobs(*),cv:cv_profiles(*)").eq("id", applicationId).eq("user_id", auth.user.id).single();
    if (!app?.job || !app.cv?.structured) throw new Error("Application context is missing.");
    if (!allowAiRequest(auth.user.id)) return NextResponse.json({ error: "Daily AI generation limit reached." }, { status: 429 });

    const answers = await structured(autoAnswersSchema, `Draft natural UK-English answers to these application questions. Use only CV evidence; never invent, infer or embellish. For every answer, return one to three cv_evidence strings that are exact quotations from the source CV and support the facts used in the answer. CV: ${JSON.stringify(app.cv.structured)}. Source CV: ${(app.cv.raw_text || "").slice(0, 14000)}. Job: ${app.job.description || app.job.title}. Questions: ${JSON.stringify(questions)}`);
    assertAnswerEvidence(answers, normaliseStructured(app.cv.structured), app.cv.raw_text);

    const { data: existing } = await auth.supabase.from("application_kits").select("id,auto_answers").eq("application_id", applicationId).eq("user_id", auth.user.id).maybeSingle();
    const previousAnswers = Array.isArray(existing?.auto_answers) ? existing.auto_answers : [];
    const allAnswers = [...previousAnswers, ...answers];
    const query = existing
      ? auth.supabase.from("application_kits").update({ auto_answers: allAnswers, model: "gpt-4o-mini" }).eq("id", existing.id).eq("user_id", auth.user.id)
      : auth.supabase.from("application_kits").insert({ user_id: auth.user.id, application_id: applicationId, cv_profile_id: app.cv.id, input_hash: "pending-kit", model: "gpt-4o-mini", auto_answers: answers });
    const { data, error } = await query.select().single();
    if (error) throw error;
    return NextResponse.json({ kit: data });
  } catch (error) { return apiError(error); }
}
