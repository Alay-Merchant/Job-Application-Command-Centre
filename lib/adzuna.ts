export const ADZUNA_COUNTRY = "gb";

export type JobResult = {
  external_id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary_min?: number;
  salary_max?: number;
  currency: string;
  url: string;
  raw: unknown;
  match_score?: number;
  recommended_cv_profile_id?: string;
  recommended_cv_label?: string;
  match_reasons?: string[];
};

export type RankingProfile = {
  id?: string;
  label?: string;
  target_role?: string | null;
  structured?: Record<string, unknown> | null;
};

const stopWords = new Set(["and", "the", "for", "with", "from", "that", "this", "role", "work", "team", "teams", "your", "you", "our", "are", "will", "have", "has", "into", "across", "through", "using", "strong", "experience", "skills", "candidate", "business", "company", "london"]);
const directionAliases: Array<{ test: RegExp; terms: string[] }> = [
  { test: /\b(pm|product)\b/i, terms: ["product", "roadmap", "discovery", "manager"] },
  { test: /\b(vc|venture|invest)\b/i, terms: ["venture", "investment", "investor", "diligence", "portfolio"] },
  { test: /\b(strategy|consult)\b/i, terms: ["strategy", "consulting", "transformation", "operating"] },
];

function words(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(/\s+/).filter((word) => word.length >= 3 && !stopWords.has(word));
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(strings);
  return [];
}

function matchedTerms(jobText: string, terms: string[]): string[] {
  const tokens = new Set(words(jobText));
  return [...new Set(terms.filter((term) => tokens.has(term)))];
}

function scoreForProfile<T extends { title: string; description: string; salary_max?: number; salary_min?: number }>(job: T, profile: RankingProfile) {
  const structured = profile.structured || {};
  const directionText = `${profile.label || ""} ${profile.target_role || ""}`;
  const direction = [...new Set([...words(directionText), ...directionAliases.filter((item) => item.test.test(directionText)).flatMap((item) => item.terms)])];
  const capabilities = [...new Set([...strings(structured.keywords), ...strings(structured.skills)].flatMap(words))];
  const evidence = [...new Set([...strings(structured.experience), ...strings(structured.projects), ...strings(structured.summary)].flatMap(words))];
  const text = `${job.title} ${job.description}`;
  const directionMatches = matchedTerms(text, direction);
  const capabilityMatches = matchedTerms(text, capabilities);
  const evidenceMatches = matchedTerms(text, evidence);
  const relevance = Math.min(35, directionMatches.length * 9) + Math.min(40, capabilityMatches.length * 5) + Math.min(15, evidenceMatches.length * 2);
  const salary = relevance ? Math.min(10, Math.round((job.salary_max || job.salary_min || 0) / 25000)) : 0;
  const reasons = [...directionMatches, ...capabilityMatches, ...evidenceMatches].filter((term, index, all) => all.indexOf(term) === index).slice(0, 4);
  return { score: Math.min(100, relevance + salary), reasons };
}

export async function searchJobs({ what = "", where = "London", salaryMin, page = 1 }: { what?: string; where?: string; salaryMin?: number; page?: number }): Promise<JobResult[]> {
  if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) throw new Error("Adzuna is not configured.");
  const params = new URLSearchParams({ app_id: process.env.ADZUNA_APP_ID, app_key: process.env.ADZUNA_APP_KEY, what, where, results_per_page: "20", "content-type": "application/json" });
  if (salaryMin) params.set("salary_min", String(salaryMin));
  const response = await fetch(`https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/${page}?${params}`, { next: { revalidate: 300 } } as RequestInit & { next: { revalidate: number } });
  if (!response.ok) throw new Error("Unable to load jobs from Adzuna.");
  const json = await response.json();
  return (json.results || []).map((job: Record<string, unknown>) => ({
    external_id: String(job.id),
    title: String(job.title || "Untitled role"),
    company: String((job.company as { display_name?: string })?.display_name || ""),
    location: String((job.location as { display_name?: string })?.display_name || ""),
    description: String(job.description || ""),
    salary_min: Number(job.salary_min) || undefined,
    salary_max: Number(job.salary_max) || undefined,
    currency: "GBP",
    url: String(job.redirect_url || ""),
    raw: job,
  }));
}

export async function salaryStats({ what, where }: { what: string; where: string }) {
  const jobs = await searchJobs({ what, where });
  const salaries = jobs.flatMap((job) => [job.salary_min, job.salary_max]).filter((value): value is number => Boolean(value));
  return { market_min: salaries.length ? Math.min(...salaries) : null, market_max: salaries.length ? Math.max(...salaries) : null, currency: "GBP", source: "Adzuna" };
}

/** Deterministic, explainable matching; it never claims skills the CV does not contain. */
export function rankJobsForProfiles<T extends { title: string; description: string; salary_max?: number; salary_min?: number }>(jobs: T[], profiles: RankingProfile[]) {
  if (!profiles.length) return jobs;
  return jobs.map((job) => {
    const ranked = profiles.map((profile) => ({ profile, ...scoreForProfile(job, profile) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    return {
      ...job,
      match_score: best.score,
      recommended_cv_profile_id: best.profile.id,
      recommended_cv_label: best.profile.label,
      match_reasons: best.reasons,
    };
  }).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
}

/** Compatibility helper for cron jobs and single-profile callers. */
export function rankJobs<T extends { title: string; description: string; salary_max?: number; salary_min?: number }>(jobs: T[], keywords: string[]) {
  return rankJobsForProfiles(jobs, [{ label: "Selected CV", structured: { keywords, skills: [] } }]);
}
