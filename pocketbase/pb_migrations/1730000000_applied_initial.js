/// <reference path="../pb_data/types.d.ts" />

// Applied's PocketBase schema. The collection rules deliberately mirror the
// previous per-user RLS model; the Next.js routes also check owned relations
// before making compound writes.
migrate((app) => {
  const ownRule = '@request.auth.id != "" && user_id = @request.auth.id';
  const ownCreateRule = '@request.auth.id != "" && @request.body.user_id = @request.auth.id';
  const ownUpdateRule = '@request.auth.id != "" && user_id = @request.auth.id && @request.body.user_id:changed = false';
  const text = (name, extra = {}) => ({ name, type: "text", ...extra });
  const json = (name, extra = {}) => ({ name, type: "json", ...extra });
  const number = (name, extra = {}) => ({ name, type: "number", ...extra });
  const bool = (name, extra = {}) => ({ name, type: "bool", ...extra });
  const select = (name, values, extra = {}) => ({ name, type: "select", maxSelect: 1, values, ...extra });
  const relation = (name, collection, extra = {}) => ({
    name,
    type: "relation",
    collectionId: collection.id,
    maxSelect: 1,
    ...extra,
  });
  const owned = (name, fields, indexes = [], relationRules = {}) => {
    const collection = new Collection({
      type: "base",
      name,
      listRule: ownRule,
      viewRule: ownRule,
      createRule: [ownCreateRule, relationRules.create].filter(Boolean).map((rule) => `(${rule})`).join(" && "),
      updateRule: [ownUpdateRule, relationRules.update].filter(Boolean).map((rule) => `(${rule})`).join(" && "),
      deleteRule: ownRule,
      fields: [relation("user_id", users, { required: true, cascadeDelete: true }), ...fields],
      indexes,
    });
    app.save(collection);
    return collection;
  };

  // PocketBase bootstraps a built-in `users` auth collection. Profile data is
  // stored separately so an upgrade never has to mutate that system schema.
  const users = app.findCollectionByNameOrId("users");

  owned("profiles", [
    text("full_name", { max: 160 }),
    text("headline", { max: 240 }),
    text("location", { max: 160 }),
    text("phone", { max: 80 }),
    json("links"),
    json("preferences"),
  ], ["CREATE UNIQUE INDEX idx_profiles_one_per_user ON profiles (user_id)"]);

  const cvs = owned("cv_profiles", [
    text("label", { required: true, max: 80 }),
    text("target_role", { max: 140 }),
    bool("is_default", { default: false }),
    select("source", ["upload", "linkedin", "manual"], { default: "upload" }),
    {
      name: "file_path",
      type: "file",
      maxSelect: 1,
      maxSize: 5242880,
      mimeTypes: [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
      protected: true,
    },
    text("raw_text", { max: 50000 }),
    json("structured"),
  ], [
    "CREATE UNIQUE INDEX idx_cv_one_default_per_user ON cv_profiles (user_id) WHERE is_default = true",
    "CREATE INDEX idx_cv_profiles_user ON cv_profiles (user_id)",
  ]);

  const jobs = owned("jobs", [
    select("source", ["adzuna", "manual"], { required: true }),
    text("external_id", { max: 200 }),
    text("title", { required: true, max: 300 }),
    text("company", { max: 300 }),
    text("location", { max: 300 }),
    text("description", { max: 100000 }),
    number("salary_min"),
    number("salary_max"),
    text("currency", { max: 8, default: "GBP" }),
    text("url", { max: 2000 }),
    json("raw"),
  ], [
    "CREATE UNIQUE INDEX idx_jobs_user_source_external ON jobs (user_id, source, external_id) WHERE external_id != ''",
    "CREATE INDEX idx_jobs_user ON jobs (user_id)",
  ]);

  const applications = owned("applications", [
    relation("job_id", jobs, { required: true, cascadeDelete: true }),
    relation("cv_profile_id", cvs, { cascadeDelete: false }),
    select("stage", ["saved", "applied", "phone_screen", "interview", "final", "offer", "rejected", "archived"], { required: true, default: "saved" }),
    number("board_order"),
    text("applied_at", { max: 40 }),
    text("next_action", { max: 500 }),
    text("next_action_due", { max: 10 }),
    text("notes", { max: 20000 }),
  ], [
    "CREATE UNIQUE INDEX idx_applications_one_per_job ON applications (user_id, job_id)",
    "CREATE INDEX idx_applications_user_stage_order ON applications (user_id, stage, board_order)",
  ], {
    create: 'job_id.user_id = @request.auth.id && (cv_profile_id = "" || cv_profile_id = null || cv_profile_id.user_id = @request.auth.id)',
    update: '(@request.body.job_id:isset = false || job_id.user_id = @request.auth.id) && (@request.body.cv_profile_id:isset = false || cv_profile_id = "" || cv_profile_id = null || cv_profile_id.user_id = @request.auth.id)',
  });

  const kits = owned("application_kits", [
    relation("application_id", applications, { required: true, cascadeDelete: true }),
    relation("cv_profile_id", cvs, { cascadeDelete: false }),
    text("input_hash", { required: true, max: 128 }),
    text("model", { max: 100 }),
    number("match_score"),
    json("match_breakdown"),
    json("missing_skills"),
    json("interview_questions"),
    json("star_prompts"),
    text("cover_letter", { max: 10000 }),
    json("tailored_cv"),
    json("ats_report"),
    json("auto_answers"),
    json("salary_insight"),
  ], [
    "CREATE UNIQUE INDEX idx_kits_one_per_application ON application_kits (application_id)",
    "CREATE INDEX idx_kits_user_hash ON application_kits (user_id, input_hash)",
  ], {
    create: 'application_id.user_id = @request.auth.id && (cv_profile_id = "" || cv_profile_id = null || cv_profile_id.user_id = @request.auth.id)',
    update: '(@request.body.application_id:isset = false || application_id.user_id = @request.auth.id) && (@request.body.cv_profile_id:isset = false || cv_profile_id = "" || cv_profile_id = null || cv_profile_id.user_id = @request.auth.id)',
  });

  owned("star_stories", [
    text("title", { required: true, max: 200 }),
    text("situation", { max: 10000 }),
    text("task", { max: 10000 }),
    text("action", { max: 10000 }),
    text("result", { max: 10000 }),
    json("competencies"),
  ]);

  const followUps = owned("follow_ups", [
    relation("application_id", applications, { required: true, cascadeDelete: true }),
    text("due_date", { required: true, max: 10 }),
    text("note", { max: 1000 }),
    bool("done", { default: false }),
    text("reminded_at", { max: 40 }),
  ], [
    "CREATE UNIQUE INDEX idx_followups_one_per_due_date ON follow_ups (application_id, due_date)",
    "CREATE INDEX idx_followups_user_due ON follow_ups (user_id, done, due_date)",
  ], {
    create: 'application_id.user_id = @request.auth.id',
    update: '@request.body.application_id:isset = false || application_id.user_id = @request.auth.id',
  });

  owned("company_targets", [
    text("name", { required: true, max: 300 }),
    text("industry", { max: 300 }),
    number("fit_score"),
    text("why_match", { max: 10000 }),
    text("roles_query", { max: 500 }),
    text("status", { max: 80, default: "suggested" }),
  ], ["CREATE INDEX idx_company_targets_user_score ON company_targets (user_id, fit_score DESC)"]);

  owned("saved_searches", [
    text("label", { max: 100 }),
    text("query", { max: 120 }),
    text("where_location", { max: 120 }),
    number("min_salary"),
    relation("cv_profile_id", cvs, { cascadeDelete: false }),
    bool("active", { default: true }),
  ], ["CREATE INDEX idx_saved_searches_user_active ON saved_searches (user_id, active)"], {
    create: 'cv_profile_id = "" || cv_profile_id = null || cv_profile_id.user_id = @request.auth.id',
    update: '@request.body.cv_profile_id:isset = false || cv_profile_id = "" || cv_profile_id = null || cv_profile_id.user_id = @request.auth.id',
  });

  const threads = owned("coach_threads", [
    relation("application_id", applications, { cascadeDelete: true }),
    text("title", { max: 120 }),
  ], ["CREATE INDEX idx_coach_threads_user ON coach_threads (user_id)"], {
    create: 'application_id = "" || application_id = null || application_id.user_id = @request.auth.id',
    update: '@request.body.application_id:isset = false || application_id = "" || application_id = null || application_id.user_id = @request.auth.id',
  });

  owned("coach_messages", [
    relation("thread_id", threads, { required: true, cascadeDelete: true }),
    select("role", ["user", "assistant"], { required: true }),
    text("content", { required: true, max: 20000 }),
  ], ["CREATE INDEX idx_coach_messages_thread ON coach_messages (thread_id)"], {
    create: 'thread_id.user_id = @request.auth.id',
    update: '@request.body.thread_id:isset = false || thread_id.user_id = @request.auth.id',
  });

  owned("application_events", [
    relation("application_id", applications, { required: true, cascadeDelete: true }),
    select("from_stage", ["saved", "applied", "phone_screen", "interview", "final", "offer", "rejected", "archived"]),
    select("to_stage", ["saved", "applied", "phone_screen", "interview", "final", "offer", "rejected", "archived"]),
    text("at", { max: 40 }),
  ], ["CREATE INDEX idx_application_events_user_application_at ON application_events (user_id, application_id, at DESC)"], {
    create: 'application_id.user_id = @request.auth.id',
    update: '@request.body.application_id:isset = false || application_id.user_id = @request.auth.id',
  });
}, (app) => {
  [
    "application_events",
    "coach_messages",
    "coach_threads",
    "saved_searches",
    "company_targets",
    "follow_ups",
    "star_stories",
    "application_kits",
    "applications",
    "jobs",
    "cv_profiles",
    "profiles",
  ].forEach((name) => {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) {
      // The migration down path is deliberately idempotent for local reset use.
    }
  });
});
