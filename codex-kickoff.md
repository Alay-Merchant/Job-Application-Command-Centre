# Codex kickoff prompt

Paste the block below into Codex with this folder as the working directory. `plan.md` and `README.md` are already here — Codex should read `plan.md` in full before writing anything.

---

```
Build the app specified in plan.md in this folder. Read plan.md completely before writing any code — it is the authoritative spec (stack, database schema, routes, features, design system, build order). README.md is the human setup guide.

Hard rules:
- The stack in plan.md §2 is LOCKED. Do not substitute frameworks or libraries. Use only the dependencies listed in §3. Adding anything else is a defect unless a listed feature is impossible without it.
- All server logic goes in Next.js Route Handlers on Vercel. Do NOT use Supabase Edge Functions.
- Use @supabase/supabase-js + a raw SQL migration (supabase/migrations/0001_init.sql). No ORM.
- RLS on every table, service-role key server-only (lib/supabase/admin.ts), auth check on every mutation, MIME + 5MB validation on uploads. Security is not optional (§15).
- AI: gpt-4o-mini by default, gpt-4o only for cover letters + coach chat. Every analytical AI call uses OpenAI structured outputs validated by a Zod schema. Cache each full kit by input_hash so re-opening costs no API call (§8, §10).
- Use shadcn/ui primitives — do not hand-roll modals/dropdowns/toasts. No state-management library. Clean & professional design system per §12 (Inter, slate + indigo-600, light + dark).

Build in the phase order in plan.md §14 (Phase 0 → 7). After each phase, ensure the app compiles and the phase's functionality works before moving on. Meet every item in the Definition of Done (§16).

Deliverables: a complete, deployable Next.js app; supabase/migrations/0001_init.sql; .env.example with all keys from §4; a working "Load sample data" action (§17); and any deploy notes appended to README.md.

Start by scaffolding Phase 0, then proceed through the phases. Keep it lean — when tempted to add a dependency or an abstraction not in the plan, re-read plan.md §0 and don't.
```

---

## Tips while it builds

- If Codex stalls or drifts, point it back to the specific plan section: *"Follow plan.md §6 for the schema exactly"* or *"Phase 4 only — don't start the kanban yet."*
- Have your Supabase project + all API keys ready **before** you start, so you can run and test each phase as it lands.
- If the one-shot runs long, ask Codex to commit after each completed phase so nothing is lost.
- First thing to verify once it's up: create two users and confirm neither can see the other's data (RLS proof, DoD §11).
