/// <reference path="../pb_data/types.d.ts" />

// Hardens the initial user-scoped rules for existing databases. In particular,
// it prevents a client from reassigning user_id or linking an owned record to a
// job, CV, application, or thread that belongs to another user.
migrate((app) => {
  const ownRule = '@request.auth.id != "" && user_id = @request.auth.id';
  const ownCreateRule = '@request.auth.id != "" && @request.body.user_id = @request.auth.id';
  const ownUpdateRule = '@request.auth.id != "" && user_id = @request.auth.id && @request.body.user_id:changed = false';
  const optionalOwned = (field) => `(${field} = "" || ${field} = null || ${field}.user_id = @request.auth.id)`;
  const optionalOwnedUpdate = (field) => `@request.body.${field}:isset = false || ${optionalOwned(field)}`;
  const requiredOwned = (field) => `${field}.user_id = @request.auth.id`;
  const requiredOwnedUpdate = (field) => `@request.body.${field}:isset = false || ${requiredOwned(field)}`;

  const relatedRules = {
    applications: {
      create: `${requiredOwned("job_id")} && ${optionalOwned("cv_profile_id")}`,
      update: `${requiredOwnedUpdate("job_id")} && ${optionalOwnedUpdate("cv_profile_id")}`,
    },
    application_kits: {
      create: `${requiredOwned("application_id")} && ${optionalOwned("cv_profile_id")}`,
      update: `${requiredOwnedUpdate("application_id")} && ${optionalOwnedUpdate("cv_profile_id")}`,
    },
    follow_ups: { create: requiredOwned("application_id"), update: requiredOwnedUpdate("application_id") },
    saved_searches: { create: optionalOwned("cv_profile_id"), update: optionalOwnedUpdate("cv_profile_id") },
    coach_threads: { create: optionalOwned("application_id"), update: optionalOwnedUpdate("application_id") },
    coach_messages: { create: requiredOwned("thread_id"), update: requiredOwnedUpdate("thread_id") },
    application_events: { create: requiredOwned("application_id"), update: requiredOwnedUpdate("application_id") },
  };

  [
    "profiles",
    "cv_profiles",
    "jobs",
    "applications",
    "application_kits",
    "star_stories",
    "follow_ups",
    "company_targets",
    "saved_searches",
    "coach_threads",
    "coach_messages",
    "application_events",
  ].forEach((name) => {
    const collection = app.findCollectionByNameOrId(name);
    const relation = relatedRules[name];
    collection.listRule = ownRule;
    collection.viewRule = ownRule;
    collection.createRule = [ownCreateRule, relation && relation.create].filter(Boolean).map((rule) => `(${rule})`).join(" && ");
    collection.updateRule = [ownUpdateRule, relation && relation.update].filter(Boolean).map((rule) => `(${rule})`).join(" && ");
    collection.deleteRule = ownRule;
    app.save(collection);
  });
}, (app) => {
  const ownRule = '@request.auth.id != "" && user_id = @request.auth.id';
  const ownCreateRule = '@request.auth.id != "" && @request.body.user_id = @request.auth.id';
  [
    "profiles",
    "cv_profiles",
    "jobs",
    "applications",
    "application_kits",
    "star_stories",
    "follow_ups",
    "company_targets",
    "saved_searches",
    "coach_threads",
    "coach_messages",
    "application_events",
  ].forEach((name) => {
    const collection = app.findCollectionByNameOrId(name);
    collection.createRule = ownCreateRule;
    collection.updateRule = ownRule;
    app.save(collection);
  });
});
