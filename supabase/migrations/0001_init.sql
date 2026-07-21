-- Applied: initial schema, access controls, and private CV storage.

create type public.app_stage as enum (
  'saved', 'applied', 'phone_screen', 'interview', 'final', 'offer', 'rejected', 'archived'
);
create type public.cv_source as enum ('upload', 'linkedin', 'manual');
create type public.job_source as enum ('adzuna', 'manual');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  headline text,
  location text,
  phone text,
  links jsonb default '{}'::jsonb,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.cv_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null,
  target_role text,
  is_default boolean default false,
  source public.cv_source default 'upload',
  file_path text,
  raw_text text,
  structured jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source public.job_source not null,
  external_id text,
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

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  job_id uuid not null references public.jobs on delete cascade,
  cv_profile_id uuid references public.cv_profiles on delete set null,
  stage public.app_stage not null default 'saved',
  board_order double precision default 0,
  applied_at timestamptz,
  next_action text,
  next_action_due date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.application_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid not null references public.applications on delete cascade,
  cv_profile_id uuid references public.cv_profiles on delete set null,
  input_hash text not null,
  model text,
  match_score int,
  match_breakdown jsonb,
  missing_skills jsonb,
  interview_questions jsonb,
  star_prompts jsonb,
  cover_letter text,
  tailored_cv jsonb,
  ats_report jsonb,
  auto_answers jsonb,
  salary_insight jsonb,
  created_at timestamptz default now(),
  unique (application_id)
);

create table public.star_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  situation text,
  task text,
  action text,
  result text,
  competencies jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid not null references public.applications on delete cascade,
  due_date date not null,
  note text,
  done boolean default false,
  reminded_at timestamptz,
  created_at timestamptz default now(),
  unique (application_id, due_date)
);

create table public.company_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  industry text,
  fit_score int,
  why_match text,
  roles_query text,
  status text default 'suggested',
  created_at timestamptz default now()
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text,
  query text,
  where_location text,
  min_salary numeric,
  cv_profile_id uuid references public.cv_profiles on delete set null,
  active boolean default true,
  created_at timestamptz default now()
);

create table public.coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid references public.applications on delete set null,
  title text,
  created_at timestamptz default now()
);

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  thread_id uuid not null references public.coach_threads on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now(),
  constraint coach_messages_role_check check (role in ('user', 'assistant'))
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  application_id uuid not null references public.applications on delete cascade,
  from_stage public.app_stage,
  to_stage public.app_stage,
  at timestamptz default now()
);

-- Indexed for the dashboard, board, daily jobs, and AI-kit cache paths.
create index cv_profiles_user_id_idx on public.cv_profiles (user_id);
create unique index cv_profiles_one_default_per_user_idx
  on public.cv_profiles (user_id) where is_default;
create index jobs_user_id_created_at_idx on public.jobs (user_id, created_at desc);
create index applications_user_stage_order_idx on public.applications (user_id, stage, board_order);
create unique index applications_one_plan_per_user_job_idx on public.applications (user_id, job_id);
create index applications_user_next_action_due_idx on public.applications (user_id, next_action_due)
  where next_action_due is not null;
create index application_kits_user_id_idx on public.application_kits (user_id);
create index application_kits_input_hash_idx on public.application_kits (user_id, input_hash);
create index star_stories_user_id_idx on public.star_stories (user_id);
create index follow_ups_user_due_date_idx on public.follow_ups (user_id, due_date) where not done;
create index company_targets_user_id_idx on public.company_targets (user_id);
create index saved_searches_active_idx on public.saved_searches (user_id) where active;
create index coach_threads_user_id_idx on public.coach_threads (user_id);
create index coach_messages_thread_created_at_idx on public.coach_messages (thread_id, created_at);
create index application_events_user_application_at_idx
  on public.application_events (user_id, application_id, at desc);

alter table public.profiles enable row level security;
alter table public.cv_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_kits enable row level security;
alter table public.star_stories enable row level security;
alter table public.follow_ups enable row level security;
alter table public.company_targets enable row level security;
alter table public.saved_searches enable row level security;
alter table public.coach_threads enable row level security;
alter table public.coach_messages enable row level security;
alter table public.application_events enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own rows" on public.cv_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.jobs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.applications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.application_kits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.star_stories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.follow_ups
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.company_targets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.saved_searches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.coach_threads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.coach_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.application_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Keep denormalised timestamps current without relying on individual API routes.
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger cv_profiles_set_updated_at before update on public.cv_profiles
  for each row execute procedure public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
  for each row execute procedure public.set_updated_at();

-- Auth is managed by Supabase. This trigger creates the application's 1:1 profile.
create function public.handle_new_user() returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Record all real stage changes and stamp the first application date.
create function public.record_application_stage_change() returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.stage is distinct from old.stage then
    if new.stage = 'applied' and new.applied_at is null then
      new.applied_at = now();
    end if;

    insert into public.application_events (user_id, application_id, from_stage, to_stage)
    values (new.user_id, new.id, old.stage, new.stage);
  end if;
  return new;
end;
$$;

create trigger applications_record_stage_change
  before update of stage on public.applications
  for each row execute procedure public.record_application_stage_change();

-- Prevent cross-tenant foreign-key references even when callers use the public API directly.
create function public.enforce_owned_references() returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'applications' then
    if not exists (select 1 from jobs where id = new.job_id and user_id = new.user_id) then raise exception 'job must belong to the application owner'; end if;
    if new.cv_profile_id is not null and not exists (select 1 from cv_profiles where id = new.cv_profile_id and user_id = new.user_id) then raise exception 'CV must belong to the application owner'; end if;
  elsif TG_TABLE_NAME = 'application_kits' then
    if not exists (select 1 from applications where id = new.application_id and user_id = new.user_id) then raise exception 'application must belong to kit owner'; end if;
    if new.cv_profile_id is not null and not exists (select 1 from cv_profiles where id = new.cv_profile_id and user_id = new.user_id) then raise exception 'CV must belong to kit owner'; end if;
  elsif TG_TABLE_NAME = 'follow_ups' then
    if not exists (select 1 from applications where id = new.application_id and user_id = new.user_id) then raise exception 'application must belong to follow-up owner'; end if;
  elsif TG_TABLE_NAME = 'saved_searches' and new.cv_profile_id is not null then
    if not exists (select 1 from cv_profiles where id = new.cv_profile_id and user_id = new.user_id) then raise exception 'CV must belong to search owner'; end if;
  elsif TG_TABLE_NAME = 'coach_threads' and new.application_id is not null then
    if not exists (select 1 from applications where id = new.application_id and user_id = new.user_id) then raise exception 'application must belong to thread owner'; end if;
  elsif TG_TABLE_NAME = 'coach_messages' then
    if not exists (select 1 from coach_threads where id = new.thread_id and user_id = new.user_id) then raise exception 'thread must belong to message owner'; end if;
  end if;
  return new;
end;
$$;
create trigger applications_owned_references before insert or update on public.applications for each row execute procedure public.enforce_owned_references();
create trigger kits_owned_references before insert or update on public.application_kits for each row execute procedure public.enforce_owned_references();
create trigger followups_owned_references before insert or update on public.follow_ups for each row execute procedure public.enforce_owned_references();
create trigger searches_owned_references before insert or update on public.saved_searches for each row execute procedure public.enforce_owned_references();
create trigger threads_owned_references before insert or update on public.coach_threads for each row execute procedure public.enforce_owned_references();
create trigger messages_owned_references before insert or update on public.coach_messages for each row execute procedure public.enforce_owned_references();

-- Private bucket. Object names are {user_id}/{cv_profile_id}/{filename}; the bucket is `cvs`.
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do update set public = false;

create policy "users can read own CV files" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "users can upload own CV files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "users can update own CV files" on storage.objects
  for update to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "users can delete own CV files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid()::text));
