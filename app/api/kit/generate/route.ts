import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";
import { kitHash } from "@/lib/hash";
import { kitSchema } from "@/lib/schemas";
import { kitPrompt } from "@/lib/prompts";
import { structured } from "@/lib/openai";
import { allowAiRequest } from "@/lib/rate-limit";
import { assertKitEvidence, normaliseStructured } from "@/lib/cv-context";

export const runtime = "nodejs";

const schema = z.object({ applicationId: z.string().regex(/^[a-z0-9]{15}$/i), force: z.boolean().optional() });

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const { applicationId, force } = schema.parse(await request.json());
    const { data: application } = await auth.pb
      .from("applications")
      .select("*,job:jobs(*),cv:cv_profiles(*)")
      .eq("id", applicationId)
      .eq("user_id", auth.user.id)
      .single();

    if (!application?.job || !application.cv?.structured) {
      throw new Error("Choose a parsed CV profile before generating a kit.");
    }

    const cv = normaliseStructured(application.cv.structured);
    const rawEvidence = application.cv.raw_text || "";
    const hash = kitHash(cv, application.job.description || "", rawEvidence);
    const { data: cached } = await auth.pb
      .from("application_kits")
      .select("*")
      .eq("application_id", applicationId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!force && cached?.input_hash === hash) return NextResponse.json({ kit: cached, cached: true });
    if (!allowAiRequest(auth.user.id)) {
      return NextResponse.json({ error: "Daily AI generation limit reached. Please try again tomorrow." }, { status: 429 });
    }

    // A valid JSON response is not enough: it must quote evidence that exists in this CV.
    let analysis: z.infer<typeof kitSchema> | undefined;
    let evidenceError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const candidate = await structured(kitSchema, kitPrompt(cv, application.job, rawEvidence));
      try {
        assertKitEvidence(candidate, cv, rawEvidence);
        analysis = candidate;
        break;
      } catch (error) {
        evidenceError = error;
      }
    }
    if (!analysis) throw evidenceError || new Error("The generated kit could not be verified against your CV.");

    const payload = {
      user_id: auth.user.id,
      application_id: applicationId,
      cv_profile_id: application.cv.id,
      input_hash: hash,
      model: "gpt-4o-mini",
      ...analysis,
    };
    const { data, error } = await auth.pb
      .from("application_kits")
      .upsert(payload, { onConflict: "application_id" })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ kit: data, cached: false });
  } catch (error) {
    return apiError(error);
  }
}
