# Applied — Job Application Command Centre

> Working product name: **Applied** (rename freely). One-liner: *Upload your CVs and a job, get a tailored application kit — match score, skill gaps, interview prep, cover letter, salary intel — and track every application to offer.*

This is a **build spec for a single one-shot Codex build**. It is deliberately prescriptive: the stack is locked, the schema is written, the routes are named. Build in the phase order given. Do not substitute libraries or add abstractions not listed here.

---

## 0. Golden rules for the one-shot (read first)

These exist so the build lands in one pass instead of wandering.

1. **Stack is locked** (Section 2). Do not swap Next for Remix, Tailwind for anything, or add an ORM. Use `supabase-js` + raw SQL migrations.
2. **One deploy target.** All server logic lives in Next.js Route Handlers on Vercel. **Do not** use Supabase Edge Functions — keep it one codebase, one deploy.
3. **Minimal dependencies.** The full allowed dependency list is in Section 3. Adding anything else is a bug unless a feature is impossible without it.
4. **Security is not optional.** RLS on every table, service-role key server-only, file validation on every upload, auth check on every mutation. See Section 6 & 15.
5. **Cheap AI by default.** `gpt-4o-mini` for everything except cover letters and coach chat (`gpt-4o`). Cache every generation by input hash so re-viewing costs nothing. See Section 10.
6. **Structured AI output.** Every analytical AI call uses OpenAI structured outputs (`response_format` json_schema) validated by a matching Zod schema. No free-text parsing.
7. **Lean components.** Use shadcn/ui primitives. Don't hand-roll a modal, dropdown, or toast. Don't add a state-management library — React state + server components are enough.
8. **Build phase-by-phase** (Section 14). Each phase must run and be manually testable before the next.

---

## 1. What it does (scope)

**Core kit** (per job application):
- **Match score** (0–100) with a breakdown (skills, experience, seniority, domain).
- **Missing skills / gaps** — what the job wants that your CV doesn't show, ranked by importance.
- **Interview questions** — likely questions for this exact role, technical + behavioural.
- **STAR-story prompts** — behavioural prompts tied to the job, plus a reusable STAR story bank.
- **Cover letter** — tailored, editable draft.
- **Tailored CV suggestions** — which of your bullets to emphasise/reword for this job.
- **Auto-answer** — drafts for common application questions ("Why this company?", screening questions).
- **ATS keyword check** — keywords the job wants that your CV is missing.
- **Salary insight + negotiation** — Adzuna salary data for the role/region + negotiation talking points.

**Understanding you**:
- **Multiple CV profiles** — one per career direction (e.g. "Strategy", "Finance", "Product"). Each parsed into structured data. App picks the best-fit profile per job, or you choose.
- **Preferences** — target roles, locations, min salary, industries, must-haves. Drive recommendations.

**Finding jobs**:
- **Live job feed** via Adzuna (UK-first, English). Search, filter by salary, save.
- **Match-to-me ranking** — saved searches ranked against your best-fit CV so the freshest, most-relevant, highest-paying roles surface first.
- **Company recommendations** — a ranked list of target companies that fit your profile + preferences, each with a rationale and a link to their open roles.

**Tracking**:
- **Kanban board** — Saved → Applied → Phone screen → Interview → Final → Offer (+ Rejected/Archived), drag between columns.
- **Follow-up tracker** — per-application next action + due date, with daily email reminders.
- **Analytics** — funnel (applied → interview → offer), response rate, skill-gap trends.

**Assistance**:
- **AI coach chat** — grounded in your CVs + a chosen application. Ask "how do I improve my odds", run mock interviews, refine answers.

**Data**:
- Login/accounts, strict per-user isolation (RLS), **GDPR export (zip of all data) and one-click account+data delete**.

Everything above is **v1**. Section 18 lists what is intentionally out.

---

## 2. Tech stack (locked)

| Layer | Choice |
|---|---|
| Framework | **Next.js 14** (App Router, TypeScript, React Server Components) |
| Hosting | **Vercel** |
| Styling | **Tailwind CSS** + **shadcn/ui** (Radix primitives) |
| Icons | **lucide-react** |
| Toasts | **sonner** |
| Backend / DB / Auth / Storage | **Supabase** (Postgres, Auth, Storage) |
| DB access | **@supabase/supabase-js** + **@supabase/ssr** (no ORM) |
| AI | **OpenAI** (`openai` SDK): `gpt-4o-mini` default, `gpt-4o` for cover letters + coach |
| Jobs data | **Adzuna API** (free dev key) |
| Email | **Resend** |
| Scheduling | **Vercel Cron** |
| Validation | **Zod** |
| PDF parse | **pdf-parse** |
| DOCX parse | **mammoth** |
| Charts | **recharts** |
| DnD (kanban) | **@dnd-kit/core** + **@dnd-kit/sortable** |

Node runtime for API routes that parse files or call OpenAI (`export const runtime = 'nodejs'`).

---

## 3. Allowed dependencies (the whole list)

```
next react react-dom typescript
tailwindcss postcss autoprefixer
@supabase/supabase-js @supabase/ssr
openai zod
lucide-react sonner class-variance-authority clsx tailwind-merge
@radix-ui/* (via shadcn add)
recharts
@dnd-kit/core @dnd-kit/sortable
pdf-parse mammoth
resend
jszip           # GDPR export bundle
date-fns
```
shadcn components to add: `button card input textarea label select badge progress tabs dialog dropdown-menu sheet table skeleton avatar sonner tooltip separator switch`.

If you reach for anything else, stop and reconsider — it's almost certainly not needed.

---

## 4. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only, NEVER exposed to client
OPENAI_API_KEY=
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
RESEND_API_KEY=
CRON_SECRET=                        # guards /api/cron/* endpoints
NEXT_PUBLIC_SITE_URL=               # e.g. https://applied.vercel.app
```
Ship a `.env.example` with these keys and empty values. Never read the service-role key outside `lib/supabase/admin.ts`.

---

## 5. Storage

Supabase Storage bucket **`cvs`** (private). Path convention: `cvs/{user_id}/{cv_profile_id}/{filename}`.
Storage RLS: users can only read/write objects where the first path segment equals their `auth.uid()`.
Upload validation (server): allow `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`; max **5 MB**.

---

## 6. Data model (SQL — `supabase/migrations/0001_init.sql`)

`user_id` is denormalised onto **every** table so each RLS policy is one line. Enable RLS on all.

```sql
-- enums
create type app_stage as enum ('saved','applied','phone_screen','interview','final','offer','rejected','archived');
create type cv_source as enum ('upload','linkedin','manual');
create type job_source as enum ('adzuna','manual');

-- profile (1:1 with auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  headline text,
  location text,
  phone text,
  links jsonb default '{}',            -- {linkedin, github, portfolio, website}
  preferences jsonb default '{}',      -- {target_roles[], locations[], min_salary, currency, industries[], must_haves[], work_mode}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CV profiles (multiple per user)
create table cv_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null,                 -- "Strategy", "Finance"...
  target_role text,
  is_default boolean default false,
  source cv_source default 'upload',
  file_path text,                      -- storage path, nullable for manual
  raw_text text,
  structured jsonb,                    -- {summary, skills[], experience[{title,company,dates,bullets[]}], education[], certifications[], keywords[]}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- jobs (saved per user; manual or from Adzuna)
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source job_source not null,
  external_id text,                    -- adzuna id (for dedupe)
  title text not null,
  company text,
  location text,
  description text,
  salary_min numeric,
  salary_max numeric,
  currency text default 'GBP',
  url text,
  raw jsonb,
  created_at timestamptz default now(),
  unique (user_id, source, external_id)
);

-- applications (a job you're pursuing)
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references jobs on delete cascade,
  cv_profile_id uuid references cv_profiles on delete set null,
  stage app_stage not null default 'saved',
  board_order double precision default 0,   -- for kanban ordering within a column
  applied_at timestamptz,
  next_action text,
  next_action_due date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- generated kit (1:1 with application, regenerable)
create table application_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid not null references applications on delete cascade,
  cv_profile_id uuid references cv_profiles on delete set null,
  input_hash text not null,            -- hash(cv.structured + job.description + version)
  model text,
  match_score int,
  match_breakdown jsonb,               -- {skills, experience, seniority, domain} each 0-100 + summary
  missing_skills jsonb,                -- [{skill, importance, how_to_address}]
  interview_questions jsonb,           -- [{question, type, why, strong_answer_hint}]
  star_prompts jsonb,                  -- [{competency, prompt}]
  cover_letter text,
  tailored_cv jsonb,                   -- [{original, suggestion, reason}]
  ats_report jsonb,                    -- {score, present[], missing[]}
  auto_answers jsonb,                  -- [{question, answer}]
  salary_insight jsonb,                -- {market_min, market_max, currency, source, negotiation_points[]}
  created_at timestamptz default now(),
  unique (application_id)
);

-- reusable STAR bank
create table star_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  situation text, task text, action text, result text,
  competencies jsonb default '[]',
  created_at timestamptz default now()
);

-- follow-ups / reminders
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid not null references applications on delete cascade,
  due_date date not null,
  note text,
  done boolean default false,
  reminded_at timestamptz,
  created_at timestamptz default now()
);

-- target company recommendations
create table company_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  industry text,
  fit_score int,
  why_match text,
  roles_query text,                    -- prefilled Adzuna search for their open roles
  status text default 'suggested',     -- suggested | interested | dismissed | applied
  created_at timestamptz default now()
);

-- saved searches (drive match-to-me + cron)
create table saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text,
  query text,
  where_location text,
  min_salary numeric,
  cv_profile_id uuid references cv_profiles on delete set null,
  active boolean default true,
  created_at timestamptz default now()
);

-- coach chat
create table coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid references applications on delete set null,
  title text,
  created_at timestamptz default now()
);
create table coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  thread_id uuid not null references coach_threads on delete cascade,
  role text not null,                  -- 'user' | 'assistant'
  content text not null,
  created_at timestamptz default now()
);

-- stage-change events for analytics funnel
create table application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid not null references applications on delete cascade,
  from_stage app_stage,
  to_stage app_stage,
  at timestamptz default now()
);
```

**RLS** — for every table above:
```sql
alter table <t> enable row level security;
create policy "own rows" on <t>
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```
(`profiles` uses `id = auth.uid()` instead of `user_id`.)

**Auto-create profile on signup** (trigger):
```sql
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure handle_new_user();
```

**Stage-change trigger** → write `application_events` whenever `applications.stage` changes; also set `applied_at` when moving into `applied` and it's null.

---

## 7. Auth

Supabase Auth. Enable: **email + password**, **magic link**, **Google OAuth**.
- `@supabase/ssr` for cookie-based sessions in Server Components + Route Handlers.
- Middleware (`middleware.ts`) protects `/(app)/*`; unauthenticated → `/login`.
- `/auth/callback` route exchanges the code for a session.
- Client: `lib/supabase/client.ts`. Server: `lib/supabase/server.ts`. Admin (service role, server-only): `lib/supabase/admin.ts`.

---

## 8. AI layer

**Models**: `gpt-4o-mini` for parsing, scoring, questions, STAR prompts, ATS, auto-answers, salary points, company recs. `gpt-4o` for cover letter and coach chat only.

**Structured outputs**: each analytical call passes a JSON schema (`response_format: { type: 'json_schema', ... }`) and is validated with the matching Zod schema in `lib/schemas.ts`. On validation failure: one retry, then surface a clean error.

**Caching / cost control** (important):
- The full kit is generated once per `input_hash = sha256(cv.structured + job.description + KIT_VERSION)`. Store on `application_kits`. Re-opening a kit reads the row — **no new API call**. A "Regenerate" button forces a fresh call.
- Truncate `job.description` and CV text to sane token caps before sending.
- Prompts live in `lib/prompts.ts` (one exported function per task). Keep them short and specific.

**Prompt tasks** (each = one function):
1. `parseCv(rawText)` → structured CV JSON (summary, skills, experience, education, certifications, keywords).
2. `generateKit(cv, job)` → single call returning match_score + breakdown + missing_skills + interview_questions + star_prompts + tailored_cv + ats_report. (Batch the analytical pieces into ONE call to save cost/latency.)
3. `coverLetter(cv, job, profile)` → text (gpt-4o).
4. `autoAnswers(cv, job, questions[])` → answers.
5. `salaryPoints(job, salaryData)` → negotiation points (Adzuna data passed in, LLM only writes talking points).
6. `recommendCompanies(cv, preferences)` → [{name, industry, fit_score, why_match, roles_query}].
7. `coachReply(history, cvContext, jobContext, message)` → streamed text (gpt-4o).

**ATS check** is deterministic where possible: extract job keywords, compare against CV keywords/text case-insensitively; LLM only ranks importance. Don't over-rely on the model for exact matching.

---

## 9. Job feed (Adzuna) — `lib/adzuna.ts`

- Search: `GET https://api.adzuna.com/v1/api/jobs/gb/search/{page}?app_id=&app_key=&what=&where=&salary_min=&results_per_page=20&content-type=application/json`.
- Functions: `searchJobs({what, where, salaryMin, page})`, `salaryStats({what, where})` (uses Adzuna histogram/`/jobsworth` or `/history` endpoint for salary benchmarking).
- Default country `gb` (UK-first). Country is a constant now; leave a single `ADZUNA_COUNTRY` const so it's a one-line change later.
- **Match-to-me ranking**: after fetching a search, compute a lightweight local score per job (keyword overlap between CV keywords and job title/description + salary weight) to order results **without** an LLM call. Only the full kit uses the LLM. `ponytail:` local heuristic ranking; swap for an embedding rank only if it measurably underperforms.

---

## 10. API routes / server actions / cron

Route Handlers under `app/api/`. Every mutation: verify session, enforce ownership (RLS already does, but check explicitly on service-role paths).

```
POST /api/cv/upload            # signed upload done client-side; this parses file -> raw_text -> parseCv -> save structured
POST /api/cv                   # create/update manual CV profile
POST /api/jobs/search          # proxy Adzuna search (keeps keys server-side) + local match ranking
POST /api/jobs/save            # persist a job to `jobs`
POST /api/applications         # create application from a job (+ pick cv profile)
PATCH /api/applications/:id    # stage change, notes, next action (kanban moves call this)
POST /api/kit/generate         # generate or return cached kit for an application
POST /api/kit/cover-letter     # (re)generate cover letter (gpt-4o)
POST /api/answers              # auto-answer questions
POST /api/salary               # Adzuna salary + negotiation points
POST /api/companies/recommend  # target company list
POST /api/coach/thread         # create thread
POST /api/coach/message        # streamed coach reply
GET  /api/export               # GDPR: zip of all user data (json + CV files) via jszip
POST /api/account/delete       # GDPR: delete auth user + cascade (service role)
GET  /api/cron/reminders       # daily: email due/overdue follow-ups (guarded by CRON_SECRET)
GET  /api/cron/job-alerts      # daily: run active saved_searches, email new top matches
```

**Cron** — `vercel.json`:
```json
{ "crons": [
  { "path": "/api/cron/reminders", "schedule": "0 8 * * *" },
  { "path": "/api/cron/job-alerts", "schedule": "0 7 * * *" }
]}
```
Cron handlers require header `Authorization: Bearer ${CRON_SECRET}`; reject otherwise.

**Email (Resend)** — `lib/resend.ts`: `sendReminderDigest(user, followUps[])`, `sendJobAlerts(user, jobs[])`. Plain, clean HTML. Include an unsubscribe-per-type toggle stored in `profiles.preferences`.

---

## 11. Frontend

**App shell**: left sidebar nav + top bar. Nav items:
`Dashboard · CV Profiles · Find Jobs · Applications (Kanban) · Companies · Coach · Insights · Settings`.

**Routes**:
```
/(auth)/login  /(auth)/signup  /auth/callback
/(app)/dashboard
/(app)/cvs                 # list + upload + view/edit structured CV per profile, set default
/(app)/jobs                # Adzuna search, filters (what/where/min salary), save, "match-to-me" toggle
/(app)/applications        # KANBAN board (dnd-kit), columns = stages; card = job+company+match+next action
/(app)/applications/:id    # detail: the full generated kit in tabs (Match | Gaps | Interview | STAR | Cover letter | ATS | Auto-answers | Salary | Notes)
/(app)/companies           # recommended target companies, save/dismiss, link to open roles
/(app)/coach               # chat threads (optionally tied to an application)
/(app)/insights            # analytics: funnel, response rate, skill-gap trends (recharts)
/(app)/settings            # profile, preferences, email prefs, GDPR export/delete
```

**Dashboard** = at-a-glance: active applications by stage, follow-ups due today, top new matches, quick "New application" action.

**Application detail** is the product's heart: pick/confirm CV profile → "Generate kit" → tabbed results, each section editable and copy-to-clipboard. Cover letter has its own regenerate + edit + copy. Show match score as a hero number with the breakdown.

---

## 12. Design system (clean & professional)

- **Type**: Inter via `next/font`. Sizes: display 30/36, h1 24, h2 18, body 14/15, small 13. Generous line-height.
- **Colour**: neutral **slate** base; single accent **indigo-600** (`#4f46e5`). Full light + dark mode (respect system, allow toggle). Backgrounds: white / `slate-950`. Borders `slate-200` / `slate-800`.
- **Match-score semantics**: <50 red-500, 50–69 amber-500, 70+ emerald-500. Use on the progress ring and badges consistently.
- **Feel**: lots of whitespace, `rounded-xl` cards, subtle `shadow-sm`, one accent, no gradients-as-decoration. Skeletons for loading, `sonner` toasts for confirms, empty states with a clear primary action.
- **Accessibility**: labelled inputs, focus rings, AA contrast, keyboard-operable kanban (dnd-kit supports it), `aria-live` on generation status.
- Reuse shadcn primitives everywhere; don't hand-roll.

---

## 13. Folder structure

```
app/
  (auth)/login/page.tsx  (auth)/signup/page.tsx  auth/callback/route.ts
  (app)/layout.tsx  (app)/dashboard/page.tsx  (app)/cvs/page.tsx
  (app)/jobs/page.tsx  (app)/applications/page.tsx  (app)/applications/[id]/page.tsx
  (app)/companies/page.tsx  (app)/coach/page.tsx  (app)/insights/page.tsx  (app)/settings/page.tsx
  api/... (routes from Section 10)
components/
  ui/            # shadcn
  layout/        # sidebar, topbar
  cv/  jobs/  kit/  kanban/  coach/  insights/  settings/
lib/
  supabase/{client,server,admin}.ts
  openai.ts  prompts.ts  schemas.ts  adzuna.ts  resend.ts  hash.ts  utils.ts
supabase/migrations/0001_init.sql
middleware.ts  vercel.json  .env.example
```

---

## 14. Build order (phases — each must run before the next)

- **Phase 0 — Scaffold.** Next+TS+Tailwind+shadcn, Supabase clients, env, app shell (sidebar/topbar), light/dark. Deployable placeholder.
- **Phase 1 — Auth + data.** Migration `0001_init.sql` (all tables, RLS, triggers), Supabase Auth (email + magic link + Google), middleware, profile auto-create, Settings→profile+preferences.
- **Phase 2 — CV profiles.** Upload to `cvs` bucket, parse (pdf-parse/mammoth) → `parseCv` → structured JSON; multi-profile CRUD, set default, view/edit structured data.
- **Phase 3 — Jobs.** Adzuna search proxy + filters + local match ranking; save jobs; manual job add (paste JD).
- **Phase 4 — Application kit (core AI).** Create application from a saved job, pick CV profile, `generateKit` (single batched call) + cover letter + ATS + auto-answers, cached by input_hash; application detail with tabbed, editable, copyable sections.
- **Phase 5 — Tracker.** Kanban board (dnd-kit) with stage columns + ordering; next-action/due; follow-ups; stage-change events.
- **Phase 6 — Extras.** Company recommendations, AI coach chat (streamed), salary insights + negotiation, saved searches + match-to-me.
- **Phase 7 — Finish.** Insights dashboard (recharts), Vercel Cron reminders + job alerts (Resend), GDPR export (jszip) + account delete, empty states, polish, `.env.example`, README.

---

## 15. Security & data handling (must-haves)

- RLS enabled and enforced on every table; policies verified (a user cannot read another's rows).
- Service-role key only in `lib/supabase/admin.ts`, only used by `/api/account/delete`, cron, and server-trusted writes. Never shipped to client.
- Upload validation: MIME + 5 MB cap, per-user storage path RLS.
- Every API mutation checks the session; cron routes check `CRON_SECRET`.
- No secrets in `NEXT_PUBLIC_*` except Supabase URL + anon key.
- **GDPR**: `/api/export` returns a zip (profile, CVs structured + files, jobs, applications, kits, stories, follow-ups, companies, coach) ; `/api/account/delete` deletes the auth user (cascades) and storage objects, after a typed confirmation.
- Rate-limit AI routes lightly (per-user in-memory or a `usage` check) to avoid runaway cost. `ponytail:` simple per-user daily counter in a `usage` table; upgrade to a real limiter only if abused.

---

## 16. Definition of done (acceptance)

1. Sign up (Google + email), land on an empty dashboard with clear next actions.
2. Upload two different CVs → each parsed into structured data → set one default.
3. Search Adzuna, filter by min salary, toggle match-to-me, save a job.
4. Create an application, generate a kit → see match score + breakdown, missing skills, interview questions, STAR prompts, cover letter, ATS report, auto-answers, salary insight — all editable and copyable. Reopening does not re-call the API; Regenerate does.
5. Move the application across the kanban board; set a next action + due date; it appears on the dashboard.
6. See recommended target companies with rationale + open-roles link.
7. Chat with the coach about a specific application; it references the right CV + job.
8. Insights page shows a funnel + response rate from real data.
9. A due follow-up triggers a reminder email (cron endpoint returns success when hit with the secret).
10. Export produces a zip of all data; delete removes the account and data.
11. A second test user sees none of the first user's data (RLS proven).
12. Builds clean, deploys to Vercel, no service-role key in the client bundle.

---

## 17. Seed / demo

Provide a "Load sample data" action in Settings (dev-friendly): inserts one sample CV profile, two sample jobs, one application with a pre-generated kit, so the UI is never empty during review. Guard it so it only adds to the current user.

---

## 18. Out of scope (v1) — say no to these

- Native mobile app / browser extension.
- Auto-applying to jobs or scraping job boards beyond Adzuna's API.
- Team/multi-user sharing, recruiter side.
- Payments/billing.
- Multi-language output (UK-first English now; `ADZUNA_COUNTRY` + prompt language are single-point changes when you want them).
- Embeddings/vector search for ranking (local keyword heuristic is enough for v1).

---

## 19. Deployment

1. Create Supabase project → run `0001_init.sql` in the SQL editor → create `cvs` storage bucket (private) + storage policies → enable Google OAuth (add Vercel callback URL).
2. Get keys: OpenAI, Adzuna (app id + key), Resend (verify a sender domain or use onboarding domain for testing).
3. Push to GitHub → import to Vercel → set all env vars → deploy. Set `NEXT_PUBLIC_SITE_URL` to the Vercel URL and add it to Supabase Auth redirect URLs.
4. Vercel Cron picks up `vercel.json` automatically.

---

*Build in phase order. Keep it lean. When a feature tempts you toward a new dependency or an abstraction, re-read Section 0.*
