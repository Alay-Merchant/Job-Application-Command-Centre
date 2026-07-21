import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";
import { rankJobsForProfiles, searchJobs } from "@/lib/adzuna";

const schema = z.object({
  what: z.string().max(120).optional(),
  where: z.string().max(120).optional(),
  salaryMin: z.number().nonnegative().optional(),
  page: z.number().int().positive().optional(),
  matchToMe: z.boolean().optional(),
  cvProfileId: z.string().regex(/^[a-z0-9]{15}$/i).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const body = schema.parse(await request.json());
    const jobs = await searchJobs(body);
    if (!body.matchToMe) return NextResponse.json({ jobs });

    let query = auth.pb.from("cv_profiles").select("id,label,target_role,structured").eq("user_id", auth.user.id);
    if (body.cvProfileId) query = query.eq("id", body.cvProfileId);
    const { data: profiles, error } = await query;
    if (error) throw error;
    if (body.cvProfileId && !profiles?.length) throw new Error("Selected CV profile was not found.");
    if (!profiles?.length) throw new Error("Upload a CV profile before using personalised job matching.");

    return NextResponse.json({ jobs: rankJobsForProfiles(jobs, profiles) });
  } catch (error) {
    return apiError(error);
  }
}
