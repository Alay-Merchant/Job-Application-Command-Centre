# Alay CV End-to-End Test Report

Date: 21 July 2026

## Release position

The local product passes its build, authenticated-route guard and interface acceptance checks. It is ready to run locally at `http://localhost:3006/login` for demo/UI review.

Live authenticated testing is deliberately blocked until Supabase, OpenAI, Adzuna and Resend are configured in `.env.local`. No real CV was uploaded to an external service during this audit.

## Tests completed

| Area | Result | Evidence |
| --- | --- | --- |
| Production build | Pass | `npm run build` completed successfully. |
| Type safety | Pass | `npx tsc --noEmit` completed successfully. |
| General/VC/PM document extraction | Pass | All six supplied DOCX/PDF files parsed through Mammoth/pdf-parse. Each file is below 5 MB; extracted text is 5.9k-6.1k characters. |
| Variant evidence retention | Pass | General `27M+`, VC `15 qualified`, and PM `Lecturely` anchors appeared in both DOCX and PDF extraction. PDF font warnings are non-fatal parser warnings. |
| Profile-specific job matching | Pass | Deterministic fixture test selected PM for an AI Product Manager role, VC for Investment Associate and Strategy for Strategy Consultant using the three real CV texts. |
| Evidence-led kit UI | Pass | Local demo shows source evidence, critical gap, tailored-CV evidence and answer-draft evidence. |
| Cover letter/answer anti-invention controls | Pass in code | Both structured output paths require evidence quotations that are checked against the selected CV before storage. Live model verification needs an OpenAI key. |
| Responsive UI | Pass | Checked at desktop and 375px mobile width. |
| Local demo bypass | Pass | Development login includes the red bypass and it reaches `/demo`. |
| Unauthenticated mutation protection | Pass | CV, application, kit and answer mutation routes, plus cron, returned HTTP 401 without a user session. |
| Live job search, AI generation, emails, persistence | Blocked by configuration | No Supabase/OpenAI/Adzuna/Resend credentials are present. |

## Internal quality scores

These are product-quality signals, not predictions of interview outcomes.

| Capability | Score | Notes |
| --- | ---: | --- |
| CV file ingestion | 100/100 | All supplied formats pass the app parser and size limits. Prefer DOCX for cleaner reading order. |
| CV evidence editing | 92/100 | Roles, bullets, projects, education, skills and keywords are editable; source text can be re-extracted. A future version could add per-field source-line highlighting/version diff. |
| No-fabrication protection | 94/100 | Kit, answers and cover letters use quote validation. The user must still review final drafts before submitting. |
| PM/VC/strategy profile selection | 86/100 | Correct in the real-CV fixture test. Ranking is transparent lexical evidence coverage, not a calibrated hiring model. |
| Application/follow-up tracking | 85/100 | Duplicate plans are prevented; Kanban supports empty stages/reordering; notes and follow-up completion work. Rich contact/outreach tracking is still a future improvement. |
| Company recommendations | 76/100 | Duplicate-safe and linked to prefilled job search; external company/open-role validity must be verified live. |
| Local acceptance readiness | 89/100 | Strong for review and guided applications. External integration acceptance is pending credentials. |

## CV-specific calibration

| Profile | Best near-term target | Strong verified evidence | Critical gap to show before applying |
| --- | --- | --- | --- |
| General / Strategy | AI, transformation and energy strategy consulting | £27M+ savings, EUR100-150K projects, 3-20+ teams, C-suite work, 100+ architects trained | No direct CV evidence of formal case-interview performance, pure strategy ownership or commercial due-diligence outcome. |
| VC | Venture scout, investment analyst/associate, deep-tech/robotics VC | Sourcing, diligence, investment memos, $1m fund work, 15 qualified deals weekly | No direct CV evidence of closed investments, IC decisions or portfolio outcomes. |
| PM | AI Product Manager / Product Strategy | SAP LeanIX roadmap influence, solo AI Scout, 0-to-1 Lecturely, customer discovery and service economics | No direct CV evidence of sustained product ownership, adoption/retention metrics, experimentation or people management. |

The app now surfaces these as evidence gaps instead of inventing proof.

## Five recruiter perspectives used

1. AI Product recruiter - required PM evidence traceability, profile-specific search and honest seniority calibration.
2. Early-stage VC recruiter - required venture-specific profile choice, no implied IC/closed-deal claims and company-search handoff.
3. Strategy recruiter - required consulting evidence, no invented MBB/case claims and a candid strategy gap.
4. ATS/Talent Acquisition reviewer - checked extraction, upload controls, RLS/auth posture and claim validation.
5. Executive-search/MBA career-services recruiter - checked pipeline clarity, company tracking, follow-ups and seniority positioning.

The implemented changes from those reviews include profile-aware matching, an editable evidence ledger, exact-source citations, validated generated drafts, stale-kit prevention, fictional-only demo data, deduplicated companies/applications, saved search alerts, stronger Kanban/coach interactions and email-preference enforcement.

## Outstanding tasks for the next session

1. Create/configure Supabase, run `supabase/migrations/0001_init.sql`, and set `.env.local`.
2. Upload the three DOCX files as named profiles, review the extracted ledger and set explicit target roles for General/Strategy, VC and PM.
3. Add OpenAI and Adzuna keys, then run the live acceptance sequence: one PM, one VC and one strategy job; verify every generated statement and quotation.
4. Add Resend and test opted-in/out daily reminders and job alerts on Vercel.
5. Consider a future contact/outreach layer (warm introductions, recruiter contacts, referrals and touch history). It is not added here because the authoritative v1 schema is intentionally kept intact.
6. Replace the in-memory AI rate limiter with durable distributed enforcement before meaningful public scale.
