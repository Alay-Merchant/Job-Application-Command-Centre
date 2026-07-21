"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { scoreTone } from "@/lib/utils";

type CompanyStatus = "suggested" | "interested" | "dismissed" | "applied";
type Company = { id: string; name: string; industry?: string | null; fit_score?: number | null; why_match?: string | null; roles_query?: string | null; status: CompanyStatus };
type RecommendationSummary = { created: number; refreshed: number; preserved: number };

const statusLabel: Record<CompanyStatus, string> = {
  suggested: "Suggested",
  interested: "Interested",
  applied: "Applied",
  dismissed: "Dismissed",
};

export function CompanyList({ initial }: { initial: Company[] }) {
  const [companies, setCompanies] = useState(initial);
  const [busy, setBusy] = useState(false);

  const recommend = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/companies/recommend", { method: "POST" });
      const json = await response.json();
      if (!response.ok) return toast.error(json.error || "Could not generate recommendations.");
      const summary = json.summary as RecommendationSummary;
      setCompanies((current) => {
        const incoming = (json.companies || []) as Company[];
        const incomingIds = new Set(incoming.map((company) => company.id));
        return [...incoming, ...current.filter((company) => !incomingIds.has(company.id))];
      });
      const parts = [
        summary.created ? `${summary.created} new` : null,
        summary.refreshed ? `${summary.refreshed} refreshed` : null,
        summary.preserved ? `${summary.preserved} existing choice${summary.preserved === 1 ? "" : "s"} kept` : null,
      ].filter(Boolean);
      toast.success(parts.length ? `Recommendations updated: ${parts.join(", ")}.` : "No new recommendations this time.");
    } catch {
      toast.error("Could not generate recommendations. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const update = async (company: Company, status: CompanyStatus) => {
    const response = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error || "Could not update this company.");
    setCompanies((items) => items.map((item) => item.id === company.id ? json.company : item));
    toast.success(status === "dismissed" ? `${company.name} dismissed.` : `${company.name} marked ${statusLabel[status].toLowerCase()}.`);
  };

  const visibleCompanies = companies.filter((company) => company.status !== "dismissed");

  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500">A focused target list makes networking and role research more deliberate.</p>
      <Button onClick={recommend} disabled={busy} aria-busy={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {busy ? "Refreshing recommendations" : "Recommend companies"}
      </Button>
    </div>
    {visibleCompanies.length ? <div className="grid gap-4 md:grid-cols-2">
      {visibleCompanies.map((company) => <Card key={company.id}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{company.name}</h2><Badge variant="secondary">{statusLabel[company.status]}</Badge></div>
              <p className="mt-1 text-sm text-slate-500">{company.industry || "Target company"}</p>
            </div>
            {company.fit_score != null ? <Badge className={scoreTone(company.fit_score)}>{company.fit_score}% fit</Badge> : null}
          </div>
          {company.why_match ? <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{company.why_match}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant={company.status === "interested" ? "secondary" : "outline"} onClick={() => update(company, "interested")} disabled={company.status === "interested"}>
              {company.status === "interested" ? <Check className="size-3" /> : null} {company.status === "interested" ? "Interested" : "Mark interested"}
            </Button>
            <Button asChild size="sm"><Link href={`/jobs?what=${encodeURIComponent(company.roles_query || company.name)}`}>Open roles</Link></Button>
            <Button size="sm" variant="ghost" onClick={() => update(company, "dismissed")}>Dismiss</Button>
          </div>
        </CardContent>
      </Card>)}
    </div> : <div className="rounded-xl border border-dashed py-14 text-center">
      <Building2 className="mx-auto size-8 text-indigo-600" />
      <h2 className="mt-4 font-semibold">Build your target-company list</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Set a default CV profile, then get an evidence-led list tailored to your direction and preferences.</p>
    </div>}
  </>;
}
