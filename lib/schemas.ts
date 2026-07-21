import { z } from "zod";

const experienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  dates: z.string(),
  bullets: z.array(z.string()),
});

const educationSchema = z.object({
  institution: z.string(),
  qualification: z.string(),
  dates: z.string(),
});

const projectSchema = z.object({
  name: z.string(),
  description: z.string(),
  bullets: z.array(z.string()),
});

/** The reviewed evidence base used for every personalised output. */
export const cvSchema = z.object({
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  certifications: z.array(z.string()),
  keywords: z.array(z.string()),
  projects: z.array(projectSchema),
});

const evidenceSchema = z.object({
  requirement: z.string(),
  cv_evidence: z.string(),
});

const criticalGapSchema = z.object({
  skill: z.string(),
  why_it_matters: z.string(),
  action: z.string(),
  cv_evidence: z.string(),
});

export const kitSchema = z.object({
  match_score: z.number().int().min(0).max(100),
  match_breakdown: z.object({
    skills: z.number().int().min(0).max(100),
    experience: z.number().int().min(0).max(100),
    seniority: z.number().int().min(0).max(100),
    domain: z.number().int().min(0).max(100),
    summary: z.string(),
    evidence: z.array(evidenceSchema),
    critical_gap: z.array(criticalGapSchema).max(1),
  }),
  missing_skills: z.array(z.object({
    skill: z.string(),
    importance: z.enum(["high", "medium", "low"]),
    how_to_address: z.string(),
    cv_evidence: z.string(),
  })),
  interview_questions: z.array(z.object({
    question: z.string(),
    type: z.enum(["behavioural", "technical", "case", "motivational"]),
    why: z.string(),
    strong_answer_hint: z.string(),
  })),
  star_prompts: z.array(z.object({ competency: z.string(), prompt: z.string() })),
  tailored_cv: z.array(z.object({
    original: z.string(),
    suggestion: z.string(),
    reason: z.string(),
    cv_evidence: z.string(),
  })),
  ats_report: z.object({
    score: z.number().int().min(0).max(100),
    present: z.array(z.string()),
    missing: z.array(z.string()),
  }),
});

export const companiesSchema = z.array(z.object({
  name: z.string(),
  industry: z.string(),
  fit_score: z.number().int().min(0).max(100),
  why_match: z.string(),
  roles_query: z.string(),
}));

export const autoAnswersSchema = z.array(z.object({
  question: z.string(),
  answer: z.string(),
  cv_evidence: z.array(z.string()).min(1).max(3),
}));

export const coverLetterSchema = z.object({
  letter: z.string().min(1).max(5000),
  evidence: z.array(z.object({ sentence: z.string(), cv_evidence: z.string() })),
});

export type CvStructured = z.infer<typeof cvSchema>;
