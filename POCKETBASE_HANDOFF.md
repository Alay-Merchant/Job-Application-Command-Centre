# PocketBase handoff

## Ready locally

The application now uses PocketBase for authentication, data, file storage and access control. The local services are running at the following addresses:

- App: `http://localhost:3006`
- PocketBase: `http://127.0.0.1:8090`
- PocketBase admin: `http://127.0.0.1:8090/_/`

Create a normal account from the app's **Create account** page, then sign in. In local development only, the red **Temporary demo bypass** opens a fictional interface without an account.

## What was migrated

- Supabase browser, server and admin clients were removed from the live application.
- PocketBase collections, indexes, file validation, ownership rules and rate limits are defined in `pocketbase/pb_migrations`.
- Authentication now uses a secure PocketBase-backed session cookie.
- Application, CV, job, company, coaching, export, search and cron routes use PocketBase.
- Direct cross-account create, update and relation-reassignment attempts are blocked by PocketBase rules as well as route-level checks.

## Verification completed

- TypeScript typecheck passed.
- Production build passed.
- PocketBase health check and local app login page both returned successfully.
- Browser testing covered sign-up, sign-out and conventional sign-in.
- API testing covered sample data, CV/job/application flows, duplicate prevention, follow-ups, exports, protected upload validation and two-account ownership isolation.

## Before a hosted launch

1. Host PocketBase separately on persistent storage. It cannot run inside Netlify or Vercel serverless functions.
2. Set `NEXT_PUBLIC_POCKETBASE_URL` to that PocketBase service's public HTTPS URL and allow the Netlify site origin in PocketBase CORS.
3. Add every variable in `.env.example` to the frontend host. Keep the PocketBase superuser password and provider keys server-only.
4. Configure PocketBase SMTP, verification and password-reset email before inviting real users.
5. Back up the persistent `pocketbase/pb_data` directory and change the local PocketBase superuser credentials if they were used beyond development.
6. Replace Vercel cron scheduling with Netlify Scheduled Functions (or another trusted scheduler) if deploying the frontend on Netlify.

## Dependency audit

`npm audit --omit=dev` currently reports zero production vulnerabilities. The project pins a tested, nested PostCSS security override for Next.js until a stable Next.js release adopts the patched version itself.

## Data migration note

This is a clean PocketBase backend. No inaccessible Supabase data was copied. If there is real historical data to preserve, export it from Supabase when access is available and import it into PocketBase deliberately rather than mixing it with the new test data.
