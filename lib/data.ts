import { createClient } from "@/lib/pocketbase/server";
import type { RecordData } from "@/lib/pocketbase/compat";

export async function getDashboardData() {
  const pb = await createClient();
  const { data: { user } } = await pb.auth.getUser();
  if (!user) return null;
  const today = new Date().toISOString().slice(0, 10);
  const [profile, applications, followUps, cvs] = await Promise.all([
    pb.from("profiles").select("*").eq("id", user.id).single(),
    pb.from("applications").select("*,job:jobs(*),kit:application_kits(match_score)").order("updated_at", { ascending: false }),
    pb.from("follow_ups").select("*, application:applications(job:jobs(title,company))").eq("done", false).lte("due_date", today).order("due_date"),
    pb.from("cv_profiles").select("*").order("created_at"),
  ]);
  return {
    user,
    profile: profile.data as RecordData | null,
    applications: (applications.data || []) as RecordData[],
    followUps: (followUps.data || []) as RecordData[],
    cvs: (cvs.data || []) as RecordData[],
  };
}
