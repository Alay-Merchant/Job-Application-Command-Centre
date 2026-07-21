import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/pocketbase/admin";
import { searchJobs, rankJobs } from "@/lib/adzuna";
import { sendJobAlerts } from "@/lib/resend";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const admin = await createAdminClient();
    const { data: searches, error } = await admin.from("saved_searches").select("*,cv:cv_profiles(structured)").eq("active", true);
    if (error) throw error;
    let sent = 0;
    for (const search of searches || []) {
      try {
        const { data: profile } = await admin.from("profiles").select("preferences").eq("id", search.user_id).maybeSingle();
        if (profile?.preferences?.job_alert_emails === false) continue;
        const jobs = await searchJobs({ what: search.query || "", where: search.where_location || "London", salaryMin: search.min_salary || undefined });
        const keywords = search.cv?.structured?.keywords || search.cv?.structured?.skills || [];
        const top = rankJobs(jobs, keywords).slice(0, 5);
        const user = await admin.raw.collection("users").getOne(search.user_id).catch(() => null);
        if (user) { await sendJobAlerts(user as { email?: string }, top); sent++; }
      } catch {
        // One failed external search must not block every user's alert digest.
      }
    }
    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Job-alert run failed." }, { status: 500 });
  }
}
