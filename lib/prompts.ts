import type { CvStructured } from "@/lib/schemas";

export const parseCvPrompt = (raw: string) => `Extract this CV into the requested structure. Preserve facts; do not invent achievements. Put personal/academic projects, venture work, clubs and leadership evidence into projects so they remain available for tailoring. Use UK English. CV:\n${raw.slice(0, 18000)}`;

export const kitPrompt = (cv: CvStructured, job: { title: string; company?: string | null; description?: string | null }, rawEvidence = "") => `Create a precise job-application analysis in UK English.

NON-NEGOTIABLE FACTUAL RULES:
- Use only facts explicitly stated in the CV evidence below. Never fabricate, infer, combine facts from different roles, or make a plausible-sounding claim.
- For every match evidence item and every CV rewrite, copy cv_evidence as an exact quotation from the source CV. For a genuine absence, use exactly "No direct CV evidence found".
- The original field in every tailored CV suggestion must be an exact existing CV bullet or project bullet. Do not create a new "original" bullet.
- Do not claim product ownership, leadership, investment decisions, closed deals, adoption, retention, experimentation, or outcomes unless directly stated.
- Identify at most one critical gap. If there is no material blocker, return an empty critical_gap array. If there is one, explain a practical honest action before applying.

Role: ${job.title} at ${job.company || "the company"}.
Job description: ${(job.description || "").slice(0, 16000)}.
Structured CV evidence: ${JSON.stringify(cv).slice(0, 18000)}.
Source CV evidence (use only as an exact source quotation): ${rawEvidence.slice(0, 14000)}`;

export const coverLetterPrompt = (cv: CvStructured, job: { title: string; company?: string | null; description?: string | null }, profile: unknown) => `Write a natural, specific UK-English cover letter (max 350 words) for ${job.title} at ${job.company || "the company"}.

NON-NEGOTIABLE FACTUAL RULES:
- Use only facts, metrics, employers, titles and outcomes explicitly present in the CV or candidate profile below.
- A LinkedIn URL is NOT evidence of an achievement. Do not make a claim based on a URL, role title, preference, or a reasonable assumption.
- Do not infer leadership, technical depth, ownership, impact, motivations, dates or qualifications that are not explicitly stated.
- If the available evidence is thin, write a shorter honest letter and focus on motivation for the role rather than filling gaps with plausible language.
- Every experience example must map directly to a stated CV bullet or profile fact. Never use generic AI phrases, clichés, or em dashes.
- Return the letter plus an evidence array. For every factual sentence in the letter, include that exact sentence and an exact supporting CV quotation. Do not cite an unrelated CV line just to make a claim look supported.

Job: ${(job.description || "").slice(0, 12000)}
Verified CV evidence: ${JSON.stringify(cv).slice(0, 12000)}
Candidate profile evidence: ${JSON.stringify(profile).slice(0, 4000)}`;

export const companiesPrompt = (cv: CvStructured, preferences: unknown) => `Recommend up to 8 specific UK target companies based on the supplied CV and preferences. Give a practical, concise reason and an Adzuna roles query for each.

NON-NEGOTIABLE EVIDENCE RULES:
- Treat the CV as the only source of candidate experience, achievements, skills, employers, qualifications and metrics.
- Preferences state what the candidate wants; they are not proof that the candidate has a skill, experience, network, clearance, or qualification.
- Do not invent, infer, embellish, or imply candidate facts. Do not claim the candidate has experience at, with, or in a company unless it is explicit in the CV.
- Make the reason a transparent fit assessment grounded in explicit CV evidence, and flag a relevant gap rather than filling it with a plausible claim.
- Recommend only real, UK-relevant companies you can identify confidently. Do not fabricate company details, open roles, or compensation.

CV evidence: ${JSON.stringify(cv)}. Preferences: ${JSON.stringify(preferences)}`;

export const coachSystem = "You are a candid, supportive UK career coach. Ground every suggestion in the supplied CV and job. Never invent candidate experience. Keep answers practical, natural and concise.";
