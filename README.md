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

2. Download the current PocketBase Windows binary from [pocketbase.io/docs](https://pocketbase.io/docs/), extract it to `pocketbase/pocketbase.exe`, and create a local PocketBase superuser. The binary and database are intentionally ignored by Git.

   ```bash
   cd pocketbase
   .\pocketbase.exe superuser upsert admin@example.com "choose-a-long-local-password"
   ```

3. Start PocketBase. Its committed migrations in [pocketbase/pb_migrations](./pocketbase/pb_migrations) automatically create the application collections, ownership rules, indexes, and protected CV file field on first start.

   ```bash
   .\pocketbase.exe serve --http=127.0.0.1:8090 --origins=http://localhost:3006,http://127.0.0.1:3006
   ```

4. Copy `.env.example` to `.env.local`, then supply the values below. `POCKETBASE_SUPERUSER_*` are only for trusted server-side account deletion and scheduled jobs; never expose them in browser code.

   ```bash
   NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
   POCKETBASE_SUPERUSER_EMAIL=admin@example.com
   POCKETBASE_SUPERUSER_PASSWORD=choose-a-long-local-password
   OPENAI_API_KEY=
   ADZUNA_APP_ID=
   ADZUNA_APP_KEY=
   RESEND_API_KEY=
   CRON_SECRET=
   NEXT_PUBLIC_SITE_URL=http://localhost:3006
   ```

5. Start the app on the same local port used by PocketBase's CORS configuration.

   ```bash
   npm run dev -- -p 3006
   ```

   On Windows, this command deliberately uses the Windows certificate store. This
   keeps local AI features working when Norton or a corporate security product
   inspects HTTPS traffic; do not disable certificate verification.

6. Open `http://localhost:3006`, choose **Create account**, and sign in with your own email and password. PocketBase's browser admin is available locally at `http://127.0.0.1:8090/_/`; it is only for backend administration, not normal app sign-in.

   In development, the sign-in page also includes a red **Temporary demo bypass** button that opens `/demo` without an account. It is hidden in production.

## Before applying to real roles

Upload and review each CV profile first. In particular, verify roles, metrics, project evidence and education in the evidence ledger. After changing source CV text, use **Re-extract facts from source** and review the result before generating a new kit.

The application score is labelled **evidence coverage**. It is a transparent indication of how much of a role is supported by the chosen CV, not a hiring prediction or an ATS pass guarantee. Treat every generated draft as a starting point to review before submission.

## Deploy with Netlify or Vercel

PocketBase is a persistent application server with a SQLite database and private files. It **cannot run inside Netlify or Vercel functions**. For a deployed app:

1. Run PocketBase on a persistent host with a mounted volume (for example, a small VPS or container host). Copy the `pocketbase/pb_migrations` folder with it and keep `pb_data` persistent and private.
2. Set `NEXT_PUBLIC_POCKETBASE_URL` in Netlify/Vercel to the public HTTPS URL of that PocketBase service. Configure PocketBase CORS to allow the deployed app origin.
3. Add the remaining variables from `.env.example` to Netlify/Vercel. Keep `POCKETBASE_SUPERUSER_PASSWORD`, OpenAI, Adzuna, Resend, and cron secrets server-only.
4. Set `NEXT_PUBLIC_SITE_URL` to the deployed frontend URL. If you use Netlify rather than Vercel, recreate the reminder and job-alert schedules with Netlify Scheduled Functions or another trusted scheduler that calls the protected cron routes.

### Netlify account-creation checklist

- `NEXT_PUBLIC_POCKETBASE_URL` must be the public **HTTPS** address of a running PocketBase instance, such as `https://pocketbase.example.com`. Do not use `http://127.0.0.1:8090` or `http://localhost:8090`: those addresses only exist on your own computer and are unreachable from Netlify.
- In PocketBase, allow the exact Netlify site origin in its CORS settings, for example `https://your-site.netlify.app` (and your custom domain if you use one).
- Add the variable in **Netlify → Site configuration → Environment variables**, then trigger a new deploy. The Next.js server reads it during the deployed build/runtime; changing a local `.env.local` does not update Netlify.
- Keep PocketBase on persistent hosting with its `pb_data` volume. A local PocketBase process stops being reachable as soon as your computer or the process stops.

For local use, no Netlify configuration is needed: leave the frontend at `http://localhost:3006` and PocketBase at `http://127.0.0.1:8090`.

## Security notes

- Every user-owned PocketBase collection has an ownership API rule and mutation routes authenticate the user.
- CV uploads accept PDF, DOCX or TXT only, validate MIME type, basic file signature and a 5 MB limit, and use a protected PocketBase file field.
- PocketBase superuser credentials are used only in server-side cron and account-deletion flows.
- The app validates stored AI-kit evidence against the selected CV before displaying it.
