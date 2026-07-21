# Applied - Job Application Command Centre

Applied helps you keep three things connected: verified CV evidence, focused job applications, and a clear search pipeline. Upload a CV and a job description to create an evidence-led application kit, then track applications, company targets, search alerts and follow-ups in one place.

The full build specification is in [plan.md](./plan.md). This file is the human setup and deployment guide.

## What it does

- Store separate, editable CV profiles for different directions such as product, venture capital and strategy.
- Compare a role against the selected CV or automatically select the best-fit profile.
- Generate an evidence-led application kit: CV coverage, an honest critical gap, tailored CV suggestions, interview preparation, ATS language, cover letter, answers and salary context.
- Require every analytical kit claim and answer to cite exact wording from the selected CV. Cover-letter generation is also validated against source-CV evidence.
- Search UK roles through Adzuna, save roles and search alerts, and create one focused application plan per role.
- Track applications on a Kanban board, with next actions, follow-up due dates, target-company recommendations and a grounded career coach.

The local `/demo` screen is intentionally fictional. It is only for testing the interface and cannot be mistaken for candidate evidence.

## Setup

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`, then supply the values below.

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   OPENAI_API_KEY=
   ADZUNA_APP_ID=
   ADZUNA_APP_KEY=
   RESEND_API_KEY=
   CRON_SECRET=
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. In the Supabase SQL editor, run [supabase/migrations/0001_init.sql](./supabase/migrations/0001_init.sql). It creates the schema, RLS policies, ownership triggers and the private `cvs` Storage bucket policies.

4. In Supabase Auth, enable Email/Password, Magic Link and Google OAuth. Add `http://localhost:3000/auth/callback` (and later the Vercel callback URL) to the allowed redirects.

5. Start the app.

   ```bash
   npm run dev
   ```

   In development, the sign-in page includes a red **Temporary demo bypass** button that opens `/demo` without an account. It is hidden in production.

## Before applying to real roles

Upload and review each CV profile first. In particular, verify roles, metrics, project evidence and education in the evidence ledger. After changing source CV text, use **Re-extract facts from source** and review the result before generating a new kit.

The application score is labelled **evidence coverage**. It is a transparent indication of how much of a role is supported by the chosen CV, not a hiring prediction or an ATS pass guarantee. Treat every generated draft as a starting point to review before submission.

## Deploy to Vercel

1. Push this repository to GitHub and import it into Vercel.
2. Add every variable from `.env.example` in Vercel. Keep `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, Adzuna, Resend and cron secrets server-only.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployed URL and add its `/auth/callback` URL in Supabase Auth.
4. Deploy. Vercel reads [vercel.json](./vercel.json) for the daily reminder and job-alert schedules.

## Security notes

- Every user-owned table has RLS and mutation routes authenticate the user.
- CV uploads accept PDF, DOCX or TXT only, validate MIME type, basic file signature and a 5 MB limit, and use private user-scoped Storage paths.
- The service-role key is used only in server-side cron/export/delete flows.
- The app validates stored AI-kit evidence against the selected CV before displaying it.
