import { NextResponse } from "next/server";
import { requireUser, apiError } from "@/lib/auth";

// Deliberately fictional fixture data. It is never presented as the user's evidence.
const structured = { summary: "Fictional product-and-strategy candidate used for interface testing.", skills: ["Product strategy", "SQL", "Python", "Go-to-market", "Stakeholder management"], experience: [{ title: "Fictional Product Strategy Manager", company: "Example Fintech", dates: "2023–Present", bullets: ["Fictional example: launched an AI-assisted workflow.", "Fictional example: led cross-functional discovery."] }], education: [{ institution: "Example Business School", qualification: "MBA", dates: "2025–2026" }], certifications: [], keywords: ["AI", "product", "strategy", "fintech", "SQL", "growth"], projects: [{ name: "Fictional project", description: "Interface-test fixture", bullets: ["Fictional evidence only."] }] };
const kit = { input_hash: "sample-v2", model: "sample", match_score: 78, match_breakdown: { skills: 82, experience: 75, seniority: 72, domain: 83, summary: "Fictional interface-test assessment; not a real candidate assessment.", evidence: [{ requirement: "Product work", cv_evidence: "Fictional example: led cross-functional discovery." }], critical_gap: [{ skill: "Experimentation", why_it_matters: "Fictional example gap.", action: "Use a truthful real example before applying.", cv_evidence: "No direct CV evidence found" }] }, missing_skills: [{ skill: "Experimentation", importance: "medium", how_to_address: "Fictional example only.", cv_evidence: "No direct CV evidence found" }], interview_questions: [{ question: "Tell me about a product decision you made with incomplete data.", type: "behavioural", why: "Fictional test question.", strong_answer_hint: "Use a real STAR story." }], star_prompts: [{ competency: "Influence", prompt: "Describe a real time you aligned stakeholders." }], tailored_cv: [{ original: "Fictional example: led cross-functional discovery.", suggestion: "Fictional example rewrite; never use it in a real application.", reason: "Demonstrates the UI only.", cv_evidence: "Fictional example: led cross-functional discovery." }], ats_report: { score: 76, present: ["Product", "AI", "Strategy"], missing: ["Experimentation", "B2B SaaS"] }, cover_letter: "Fictional placeholder text for UI testing only. Do not use in an application.", auto_answers: [{ question: "Why this company?", answer: "Fictional placeholder answer for UI testing only." }], salary_insight: { market_min: 90000, market_max: 135000, currency: "GBP", source: "Fictional demo estimate", negotiation_points: ["Use current, role-specific information before negotiating."] } };

export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { data: existing } = await auth.pb.from("cv_profiles").select("id").eq("user_id", auth.user.id).limit(1);
    if (existing?.length) return NextResponse.json({ ok: true, existing: true });
    const { data: cv, error: cvError } = await auth.pb.from("cv_profiles").insert({ user_id: auth.user.id, label: "Fictional product example", target_role: "Fictional Product Manager", is_default: true, source: "manual", raw_text: structured.summary, structured }).select().single();
    if (cvError || !cv) throw cvError || new Error("Could not create sample CV.");
    const jobs = [{ user_id: auth.user.id, source: "manual", title: "Product Manager, AI", company: "Example Fintech", location: "London", description: "Fictional job used only to populate the interface.", salary_min: 100000, salary_max: 135000, currency: "GBP", url: "https://example.com/careers" }, { user_id: auth.user.id, source: "manual", title: "Investor / Portfolio Strategy", company: "Example Venture Fund", location: "London", description: "Fictional job used only to populate the interface.", salary_min: 110000, salary_max: 150000, currency: "GBP", url: "https://example.com/careers" }];
    const { data: savedJobs, error: jobsError } = await auth.pb.from("jobs").insert(jobs).select();
    if (jobsError || !savedJobs) throw jobsError || new Error("Could not create sample jobs.");
    const { data: application, error: appError } = await auth.pb.from("applications").insert({ user_id: auth.user.id, job_id: savedJobs[0].id, cv_profile_id: cv.id, stage: "applied", board_order: Date.now(), next_action: "Fictional follow-up", next_action_due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) }).select().single();
    if (appError || !application) throw appError || new Error("Could not create sample application.");
    const { error: kitError } = await auth.pb.from("application_kits").insert({ ...kit, user_id: auth.user.id, application_id: application.id, cv_profile_id: cv.id });
    if (kitError) throw kitError;
    await auth.pb.from("company_targets").insert([{ user_id: auth.user.id, name: "Example Fintech", industry: "Fictional product company", fit_score: 82, why_match: "Fictional test recommendation.", roles_query: "product manager", status: "interested" }, { user_id: auth.user.id, name: "Example Venture Fund", industry: "Fictional venture fund", fit_score: 74, why_match: "Fictional test recommendation.", roles_query: "venture scout", status: "suggested" }]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
