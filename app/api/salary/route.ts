import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";
import { salaryStats } from "@/lib/adzuna";
import { structured } from "@/lib/openai";
import { allowAiRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ applicationId: z.string().regex(/^[a-z0-9]{15}$/i) });
const pointsSchema = z.object({ negotiation_points: z.array(z.string()).min(3).max(6) });

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { applicationId } = schema.parse(await request.json());
    const { data: application } = await auth.pb.from("applications").select("*,job:jobs(*)").eq("id", applicationId).eq("user_id", auth.user.id).single();
    if (!application?.job) throw new Error("Application not found.");

    const stats = await salaryStats({ what: application.job.title, where: application.job.location || "London" });
    let negotiationPoints = [
      "Anchor your conversation in role scope and comparable market data.",
      "Ask how base, bonus, equity and pension combine into total compensation.",
      "Agree your priorities before discussing a number, and remain warm and specific.",
    ];
    if (process.env.OPENAI_API_KEY && allowAiRequest(auth.user.id)) {
      negotiationPoints = (await structured(
        pointsSchema,
        `Write practical salary-negotiation points for this role using these data. No invented market facts. Role: ${application.job.title}. Data: ${JSON.stringify(stats)}`,
      )).negotiation_points;
    }

    const salary_insight = { ...stats, negotiation_points: negotiationPoints };
    const { data: existing } = await auth.pb.from("application_kits").select("id").eq("application_id", applicationId).eq("user_id", auth.user.id).maybeSingle();
    const query = existing
      ? auth.pb.from("application_kits").update({ salary_insight, model: "gpt-4o-mini" }).eq("id", existing.id).eq("user_id", auth.user.id)
      : auth.pb.from("application_kits").insert({ user_id: auth.user.id, application_id: applicationId, cv_profile_id: application.cv_profile_id, input_hash: "pending-kit", model: "gpt-4o-mini", salary_insight });
    const { data, error } = await query.select().single();
    if (error) throw error;
    return NextResponse.json({ kit: data });
  } catch (error) {
    return apiError(error);
  }
}
