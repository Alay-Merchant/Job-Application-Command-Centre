import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";
import { cvSchema } from "@/lib/schemas";
import { parseCvPrompt } from "@/lib/prompts";
import { structured } from "@/lib/openai";
import { allowAiRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ cvId: z.string().regex(/^[a-z0-9]{15}$/i), rawText: z.string().min(1).max(40000) });

/** Rebuilds structured facts from a reviewed source CV without creating a second profile. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { cvId, rawText } = schema.parse(await request.json());
    const { data: existing } = await auth.pb.from("cv_profiles").select("id").eq("id", cvId).eq("user_id", auth.user.id).single();
    if (!existing) throw new Error("CV profile not found.");
    if (!allowAiRequest(auth.user.id)) return NextResponse.json({ error: "Daily AI generation limit reached. Please try again tomorrow." }, { status: 429 });
    const parsed = await structured(cvSchema, parseCvPrompt(rawText));
    const { data, error } = await auth.pb
      .from("cv_profiles")
      .update({ raw_text: rawText, structured: parsed, updated_at: new Date().toISOString() })
      .eq("id", cvId)
      .eq("user_id", auth.user.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ cv: data });
  } catch (error) {
    return apiError(error);
  }
}
