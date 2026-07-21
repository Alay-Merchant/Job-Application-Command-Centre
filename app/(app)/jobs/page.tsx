import { JobSearch } from "@/components/jobs/job-search";
import { createClient } from "@/lib/supabase/server";

export default async function JobsPage({ searchParams }: { searchParams: { what?: string; where?: string } }) {
  const supabase = await createClient();
  const [{ data: jobs }, { data: cvs }, { data: savedSearches }] = await Promise.all([
    supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from("cv_profiles").select("id,label,target_role,is_default").order("created_at", { ascending: false }),
    supabase.from("saved_searches").select("*").order("created_at", { ascending: false }).limit(12),
  ]);
  return <div className="page"><div className="mb-7"><p className="text-sm font-medium text-indigo-600">UK-first job discovery</p><h1 className="mt-1 text-2xl font-semibold">Find work worth applying for</h1><p className="mt-2 text-sm text-slate-500">Compare your career-direction CVs, then turn the strongest fit into a focused application plan.</p></div><JobSearch saved={(jobs || []) as never[]} cvs={cvs || []} savedSearches={savedSearches || []} initialWhat={searchParams.what || "Product Manager"} initialWhere={searchParams.where || "London"} /></div>;
}
