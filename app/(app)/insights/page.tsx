import { InsightsDashboard } from "@/components/insights/insights-dashboard";
import { createClient } from "@/lib/pocketbase/server";

export default async function InsightsPage() {
  const pb = await createClient();
  const [{ data: applications }, { data: kits }] = await Promise.all([
    pb.from("applications").select("stage,created_at"),
    pb.from("application_kits").select("missing_skills"),
  ]);
  return <div className="page"><div className="mb-7"><p className="text-sm font-medium text-indigo-600">Learn from your search</p><h1 className="mt-1 text-2xl font-semibold">Insights</h1><p className="mt-2 text-sm text-slate-500">Use the real shape of your pipeline to decide what to improve next.</p></div><InsightsDashboard applications={applications || []} kits={kits as never[] || []} /></div>;
}
