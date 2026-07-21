"use client";

import { useState } from "react";
import { Bookmark, BriefcaseBusiness, Loader2, Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatMoney, scoreTone, truncate } from "@/lib/utils";

type CV = { id: string; label: string; target_role?: string | null; is_default?: boolean };
type Job = {
  external_id?: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary_min?: number;
  salary_max?: number;
  currency: string;
  url?: string;
  raw?: unknown;
  match_score?: number;
  recommended_cv_profile_id?: string;
  recommended_cv_label?: string;
  match_reasons?: string[];
};
type SavedSearch = { id: string; label?: string | null; query?: string | null; where_location?: string | null; min_salary?: number | null; cv_profile_id?: string | null; active: boolean };

export function JobSearch({ saved = [], cvs = [], savedSearches = [], initialWhat = "Product Manager", initialWhere = "London" }: { saved?: Array<Job & { id: string }>; cvs?: CV[]; savedSearches?: SavedSearch[]; initialWhat?: string; initialWhere?: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [what, setWhat] = useState(initialWhat);
  const [where, setWhere] = useState(initialWhere);
  const [salary, setSalary] = useState("");
  const [profileId, setProfileId] = useState("auto");
  const [alerts, setAlerts] = useState(savedSearches);
  const router = useRouter();
  const defaultCv = cvs.find((cv) => cv.is_default) || cvs[0];

  const cvForPlan = (job?: Job) => profileId === "auto" ? job?.recommended_cv_profile_id || defaultCv?.id : profileId;

  async function search(): Promise<void> {
    setBusy(true);
    const response = await fetch("/api/jobs/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ what, where, salaryMin: Number(salary || 0) || undefined, matchToMe: match, cvProfileId: profileId === "auto" ? undefined : profileId }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) { toast.error(json.error); return; }
    setJobs(json.jobs);
  }

  async function plan(jobId: string, cvProfileId?: string) {
    if (!cvProfileId) return toast.error("Choose a CV profile before creating an application plan.");
    const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: jobId, cv_profile_id: cvProfileId }) });
    const json = await response.json();
    if (!response.ok) { toast.error(json.error); return; }
    if (json.existing) toast.message("Opening the existing application plan for this role.");
    router.push(`/applications/${json.application.id}`);
  }

  async function save(job: Job, makeApplication = false): Promise<void> {
    const response = await fetch("/api/jobs/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...job, source: job.external_id ? "adzuna" : "manual" }) });
    const json = await response.json();
    if (!response.ok) { toast.error(json.error); return; }
    toast.success("Job saved.");
    if (makeApplication) await plan(json.job.id, cvForPlan(job));
  }

  async function saveAlert() {
    if (!what.trim()) return toast.error("Add a role or keyword before saving an alert.");
    const response = await fetch("/api/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: `${what} · ${where || "Anywhere"}`, query: what, where_location: where || null, min_salary: Number(salary || 0) || null, cv_profile_id: profileId === "auto" ? defaultCv?.id || null : profileId }) });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error);
    setAlerts((current) => current.some((item) => item.id === json.search.id) ? current : [json.search, ...current]);
    toast.success(json.existing ? "This job alert is already saved." : "Job alert saved.");
  }

  async function toggleAlert(alert: SavedSearch) {
    const response = await fetch("/api/saved-searches", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: alert.id, active: !alert.active }) });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error);
    setAlerts((current) => current.map((item) => item.id === alert.id ? json.search : item));
  }

  return <>
    <Card><CardContent className="p-5">
      <form onSubmit={(event) => { event.preventDefault(); void search(); }} className="grid gap-3 md:grid-cols-[1.4fr_1fr_.7fr_auto]">
        <Input value={what} onChange={(event) => setWhat(event.target.value)} aria-label="Job title or keywords" placeholder="Job title or keywords" />
        <Input value={where} onChange={(event) => setWhere(event.target.value)} aria-label="Location" placeholder="Location" />
        <Input value={salary} onChange={(event) => setSalary(event.target.value)} aria-label="Minimum salary" type="number" min="0" placeholder="Min salary" />
        <Button disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Search jobs</Button>
      </form>
      <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={match} onChange={(event) => setMatch(event.target.checked)} className="size-4 accent-indigo-600" />Match to my CVs</label>{match && <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">Rank using<select aria-label="CV profile for matching" value={profileId} onChange={(event) => setProfileId(event.target.value)} className="h-9 rounded-lg border bg-transparent px-2 text-sm"><option value="auto">Best-fit CV automatically</option>{cvs.map((cv) => <option value={cv.id} key={cv.id}>{cv.label}{cv.is_default ? " (default)" : ""}</option>)}</select></label>}</div>
        <div className="flex gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => void saveAlert()}>Save alert</Button><Button type="button" variant="ghost" size="sm" onClick={() => setManualOpen((open) => !open)}><Plus className="size-4" />Paste a job description</Button></div>
      </div>
      {match && <p className="mt-3 text-xs text-slate-500">Ranking compares the job language against the selected CV, or each of your CV profiles in automatic mode. It is an evidence-coverage signal, not a hiring prediction.</p>}
      {manualOpen && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ title: String(form.get("title")), company: String(form.get("company")), location: String(form.get("location")), description: String(form.get("description")), salary_min: Number(form.get("salary_min") || 0) || undefined, salary_max: Number(form.get("salary_max") || 0) || undefined, currency: "GBP", url: String(form.get("url") || "") || undefined }, true); }} className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2"><Input name="title" aria-label="Role title" placeholder="Role title" required /><Input name="company" aria-label="Company" placeholder="Company" required /><Input name="location" aria-label="Location" defaultValue={where || "London"} /><Input name="url" aria-label="Role link" type="url" placeholder="Role link" /><Input name="salary_min" aria-label="Salary minimum" type="number" placeholder="Salary minimum" /><Input name="salary_max" aria-label="Salary maximum" type="number" placeholder="Salary maximum" /><Textarea name="description" aria-label="Job description" required className="sm:col-span-2" placeholder="Paste the full job description." /><div className="sm:col-span-2"><Button><BriefcaseBusiness className="size-4" />Save & create application plan</Button></div></form>}
    </CardContent></Card>

    {alerts.length > 0 && <section className="mt-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Search alerts</h2><p className="text-xs text-slate-500">Active alerts are checked by the daily job-alert schedule once email is configured.</p></div><div className="mt-3 flex flex-wrap gap-2">{alerts.map((alert) => <button key={alert.id} type="button" onClick={() => void toggleAlert(alert)} className={`rounded-full border px-3 py-1.5 text-sm ${alert.active ? "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200" : "text-slate-500"}`}>{alert.active ? "Alert on" : "Alert paused"}: {alert.label || alert.query}</button>)}</div></section>}

    {saved.length > 0 && <section className="mt-6"><h2 className="font-semibold">Saved jobs</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{saved.map((job) => <Card key={job.id}><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium">{job.title}</p><p className="text-sm text-slate-500">{job.company} · {job.location}</p></div><Button size="sm" onClick={() => void plan(job.id, cvForPlan(job))}>Create plan</Button></CardContent></Card>)}</div></section>}

    <div className="mt-6 flex items-center justify-between"><h2 className="font-semibold">{jobs.length ? `${jobs.length} roles found` : "Search live UK roles"}</h2>{match && <span className="flex items-center gap-1 text-xs text-slate-500"><SlidersHorizontal className="size-3" />Ranked by CV language and salary</span>}</div>
    <div className="mt-3 space-y-3">{jobs.map((job, index) => <Card key={`${job.external_id}-${index}`}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{job.title}</h3>{job.match_score !== undefined && <Badge className={scoreTone(job.match_score)}>{job.match_score}% evidence coverage</Badge>}{job.recommended_cv_label && <Badge variant="secondary">Best CV: {job.recommended_cv_label}</Badge>}</div><p className="mt-1 text-sm text-slate-500">{job.company} · {job.location}</p>{job.match_reasons?.length ? <p className="mt-2 text-xs text-slate-500">Matched language: {job.match_reasons.join(", ")}</p> : null}<p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{truncate(job.description, 300)}</p><p className="mt-3 text-sm font-medium">{formatMoney(job.salary_min, job.currency)} – {formatMoney(job.salary_max, job.currency)}</p></div><div className="flex shrink-0 flex-wrap gap-2">{job.url && <Button asChild variant="ghost" size="sm"><a href={job.url} target="_blank" rel="noreferrer">Open posting</a></Button>}<Button variant="outline" size="sm" onClick={() => void save(job)}><Bookmark className="size-4" />Save</Button><Button size="sm" onClick={() => void save(job, true)}>Create plan</Button></div></CardContent></Card>)}</div>
    {!jobs.length && !busy && <div className="mt-6 rounded-xl border border-dashed p-10 text-center"><Search className="mx-auto size-7 text-indigo-600" /><p className="mt-3 font-medium">Search by role, company, or capability</p><p className="mt-1 text-sm text-slate-500">Results come from Adzuna and can be ranked against the CV profile that fits best.</p></div>}
  </>;
}
