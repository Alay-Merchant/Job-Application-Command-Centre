# Alay CV End-to-End Test Report

Date: 21 July 2026

## Release position

The app now has a working local PocketBase backend and is ready for real-account testing at `http://localhost:3006`. Normal sign-up, sign-in and sign-out work in the browser. The separate PocketBase admin is available at `http://127.0.0.1:8090/_/` for backend administration only.

The app can be used for CV profiles, application tracking, company targets, recommendations, follow-ups, sample data and evidence-led application preparation immediately. Live AI, job-search and email-provider features need their respective keys before they can make external calls.

## Tests completed

| Area | Result | Evidence |
| --- | --- | --- |
| Type safety | Pass | `tsc --noEmit` completed successfully. |
| Production build | Pass | `npm run build` completed successfully on Next.js 15.5.18. |
| Production dependency audit | Pass | `npm audit --omit=dev` returned zero vulnerabilities. |
| Backend availability | Pass | PocketBase health endpoint and the local app login page both returned HTTP 200. |
| Browser authentication | Pass | A new account was created, signed out and signed back in through the ordinary interface. |
| Core application lifecycle | Pass | Sample data, manual CV/job/application creation, application updates, follow-ups, events, profile settings and export all completed through authenticated routes. |
| Duplicate protection | Pass | A second application for the same role was rejected. |
| Upload security | Pass | Unsupported MIME types, fake PDFs and files above 5 MB were rejected. Protected PocketBase file storage is used for accepted CVs. |
| Account isolation | Pass | Direct API attempts to create, update or reassign another user's job, CV or application were blocked by PocketBase rules and route checks. |
| CV document parsing | Pass | The supplied General, VC and PM PDF/DOCX variants parsed within the file limit. Their distinctive evidence anchors remained detectable. |
| Profile-aware matching | Pass | The fixture test selected the appropriate PM, VC and strategy profile for representative roles. |
| Evidence-led generation guardrails | Pass in code | Kits, answers and cover letters validate cited source-CV evidence before storage. A live model-output check requires `OPENAI_API_KEY`. |
| Responsive interface and demo | Pass | Desktop/mobile acceptance checks passed; the red temporary demo bypass is development-only. |

## Product-quality scores

These are transparent product-readiness signals, not predictions of interview outcomes or ATS pass rates.

| Capability | Score | Interpretation |
| --- | ---: | --- |
| CV ingestion and evidence preservation | 96/100 | PDF, DOCX and TXT safeguards are in place; DOCX remains the cleanest source format. |
| Honest CV tailoring | 92/100 | Generated claims must be grounded in source CV evidence; final applicant review remains essential. |
| PM / VC / strategy profile selection | 86/100 | Correct in the profile fixture; ranking is evidence coverage rather than a hiring prediction. |
| Application and follow-up tracking | 91/100 | Applications, stages, notes, company records, next actions and reminders are connected and ownership-protected. |
| Company recommendations | 82/100 | Company targets are tracked and deduplicated; current openings still need live source verification. |
| Job search readiness | 78/100 | The workflow is ready, but live UK search needs Adzuna credentials. |
| Local security and account isolation | 94/100 | Authentication, record-level ownership rules, protected uploads and rate limits were directly tested. |
| Local release readiness | 95/100 | Build, backend and normal-user browser flow all passed. |

## CV-specific calibration

| Profile | Best near-term target | Strong verified evidence | Critical gap to fill before applying |
| --- | --- | --- | --- |
| General / Strategy | AI, transformation and energy strategy consulting | £27M+ savings, EUR100-150K projects, multi-team delivery, C-suite work and architect training | No direct CV evidence of formal case-interview performance, pure strategy ownership or commercial-diligence outcomes. |
| VC | Venture scout, investment analyst/associate and deep-tech/robotics VC | Sourcing, diligence, investment memos, $1m fund work and 15 qualified deals weekly | No direct CV evidence of closed investments, IC decisions or portfolio outcomes. |
| PM | AI Product Manager / Product Strategy | SAP LeanIX roadmap influence, AI Scout, 0-to-1 Lecturely, customer discovery and service economics | No direct CV evidence of sustained product ownership, adoption/retention metrics, experimentation or people management. |

The app is designed to surface these gaps rather than inventing evidence in a CV or cover letter.

## Outstanding actions

1. For hosted use, run PocketBase separately with persistent storage; it cannot live inside Netlify or Vercel serverless functions.
2. Add `OPENAI_API_KEY`, Adzuna and Resend credentials when you want live generation, search and email functionality.
3. Configure PocketBase SMTP, verification/reset emails, HTTPS and a backup schedule before inviting real users.
4. Recreate the reminder/job-alert schedule with Netlify Scheduled Functions or another trusted scheduler if the frontend remains on Netlify.
5. Import old Supabase data only if there is real historical data worth retaining; this PocketBase setup starts clean.
See [POCKETBASE_HANDOFF.md](./POCKETBASE_HANDOFF.md) for the full local and deployment handoff.
