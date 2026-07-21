import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";

const schema = z.object({
  job_id: z.string().regex(/^[a-z0-9]{15}$/i),
  cv_profile_id: z.string().regex(/^[a-z0-9]{15}$/i).nullable().optional(),
  stage: z.enum(["saved", "applied", "phone_screen", "interview", "final", "offer", "rejected", "archived"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const body = schema.parse(await request.json());
    const { data: job } = await auth.pb.from("jobs").select("id,company").eq("id", body.job_id).eq("user_id", auth.user.id).single();
    if (!job) throw new Error("Job not found.");

    const { data: existing } = await auth.pb.from("applications").select("*").eq("job_id", body.job_id).eq("user_id", auth.user.id).maybeSingle();
    if (existing) return NextResponse.json({ application: existing, existing: true });

    const cvId = body.cv_profile_id
      || (await auth.pb.from("cv_profiles").select("id").eq("user_id", auth.user.id).eq("is_default", true).maybeSingle()).data?.id
      || null;
    if (!cvId) throw new Error("Choose a CV profile before creating an application.");
    const { data: cv } = await auth.pb.from("cv_profiles").select("id").eq("id", cvId).eq("user_id", auth.user.id).single();
    if (!cv) throw new Error("CV profile not found.");

    const { data, error } = await auth.pb
      .from("applications")
      .insert({ ...body, cv_profile_id: cvId, stage: body.stage ?? "saved", user_id: auth.user.id, board_order: Date.now() })
      .select()
      .single();
    if (error || !data) throw error || new Error("Could not create application.");

    if (job.company) {
      await auth.pb.from("company_targets").update({ status: "applied" }).eq("user_id", auth.user.id).ilike("name", job.company);
    }
    return NextResponse.json({ application: data, existing: false });
  } catch (error) {
    return apiError(error);
  }
}
