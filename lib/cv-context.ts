import type { z } from "zod";
import { cvSchema, kitSchema, type CvStructured } from "@/lib/schemas";

type KitAnalysis = z.infer<typeof kitSchema>;

/** Makes profiles created before the projects field backward-compatible. */
export function normaliseStructured(value: unknown): CvStructured {
  const source = (value && typeof value === "object" ? value : {}) as Partial<CvStructured>;
  return cvSchema.parse({
    summary: source.summary || "",
    skills: source.skills || [],
    experience: source.experience || [],
    education: source.education || [],
    certifications: source.certifications || [],
    keywords: source.keywords || [],
    projects: source.projects || [],
  });
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function evidenceCorpus(cv: CvStructured, rawText?: string | null): string {
  const evidence = [
    cv.summary,
    ...cv.skills,
    ...cv.keywords,
    ...cv.certifications,
    ...cv.experience.flatMap((role) => [role.title, role.company, role.dates, ...role.bullets]),
    ...cv.education.flatMap((item) => [item.institution, item.qualification, item.dates]),
    ...cv.projects.flatMap((project) => [project.name, project.description, ...project.bullets]),
    rawText || "",
  ];
  return normalise(evidence.join("\n"));
}

function isSupportedQuote(quote: string, corpus: string): boolean {
  const candidate = normalise(quote);
  return candidate.length >= 8 && corpus.includes(candidate);
}

function isNoDirectEvidence(value: string): boolean {
  return /^no (direct|matching) (cv )?evidence/i.test(value.trim());
}

/**
 * The model is asked to quote exact evidence. This check makes that promise
 * enforceable before a kit is stored or shown to the candidate.
 */
export function assertKitEvidence(analysis: KitAnalysis, cv: CvStructured, rawText?: string | null): void {
  const corpus = evidenceCorpus(cv, rawText);
  const unsupported: string[] = [];
  for (const item of analysis.match_breakdown.evidence) {
    if (!isSupportedQuote(item.cv_evidence, corpus)) unsupported.push(`match evidence: ${item.cv_evidence}`);
  }
  for (const item of analysis.match_breakdown.critical_gap) {
    if (!isSupportedQuote(item.cv_evidence, corpus) && !isNoDirectEvidence(item.cv_evidence)) unsupported.push(`critical gap: ${item.cv_evidence}`);
  }
  for (const item of analysis.missing_skills) {
    if (!isSupportedQuote(item.cv_evidence, corpus) && !isNoDirectEvidence(item.cv_evidence)) unsupported.push(`gap: ${item.cv_evidence}`);
  }
  for (const item of analysis.tailored_cv) {
    if (!isSupportedQuote(item.original, corpus) || !isSupportedQuote(item.cv_evidence, corpus)) unsupported.push(`CV rewrite: ${item.original}`);
  }
  if (unsupported.length) {
    throw new Error("The generated kit could not be traced to your CV evidence. Please regenerate it.");
  }
}

/** Verifies that generated free-text application answers cite real CV wording. */
export function assertAnswerEvidence(items: Array<{ cv_evidence: string[] }>, cv: CvStructured, rawText?: string | null): void {
  const corpus = evidenceCorpus(cv, rawText);
  const unsupported = items.flatMap((item) => item.cv_evidence.filter((quote) => !isSupportedQuote(quote, corpus)));
  if (unsupported.length) throw new Error("The generated answer could not be traced to your CV evidence. Please regenerate it.");
}

export function assertCoverLetterEvidence(result: { letter: string; evidence: Array<{ sentence: string; cv_evidence: string }> }, cv: CvStructured, rawText?: string | null): void {
  const corpus = evidenceCorpus(cv, rawText);
  const letter = normalise(result.letter);
  for (const item of result.evidence) {
    if (!normalise(item.sentence) || !letter.includes(normalise(item.sentence)) || !isSupportedQuote(item.cv_evidence, corpus)) {
      throw new Error("The cover letter could not be traced to your CV evidence. Please regenerate it.");
    }
  }
}
