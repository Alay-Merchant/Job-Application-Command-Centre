/// <reference path="../pb_data/types.d.ts" />

// On update, PocketBase resolves collection fields against the pre-update
// record. Validate a submitted relation ID through @collection instead, so an
// owned record cannot be moved to another user's job, CV, application, or
// thread in a direct REST request.
migrate((app) => {
  const ownRule = '@request.auth.id != "" && user_id = @request.auth.id';
  const ownCreateRule = '@request.auth.id != "" && @request.body.user_id = @request.auth.id';
  const ownUpdateRule = '@request.auth.id != "" && user_id = @request.auth.id && @request.body.user_id:changed = false';
  const bodyOwns = (collection, field, alias) => `(@collection.${collection}:${alias}.id ?= @request.body.${field} && @collection.${collection}:${alias}.user_id ?= @request.auth.id)`;
  const required = (collection, field, alias) => bodyOwns(collection, field, alias);
  const requiredUpdate = (collection, field, alias) => `(@request.body.${field}:isset = false || ${bodyOwns(collection, field, alias)})`;
  const optional = (collection, field, alias) => `(@request.body.${field} = "" || @request.body.${field} = null || ${bodyOwns(collection, field, alias)})`;
  const optionalUpdate = (collection, field, alias) => `(@request.body.${field}:isset = false || ${optional(collection, field, alias)})`;
  const relatedRules = {
    applications: {
      create: `(${required("jobs", "job_id", "job")} && ${optional("cv_profiles", "cv_profile_id", "cv")})`,
      update: `(${requiredUpdate("jobs", "job_id", "job")} && ${optionalUpdate("cv_profiles", "cv_profile_id", "cv")})`,
    },
    application_kits: {
      create: `(${required("applications", "application_id", "application")} && ${optional("cv_profiles", "cv_profile_id", "cv")})`,
      update: `(${requiredUpdate("applications", "application_id", "application")} && ${optionalUpdate("cv_profiles", "cv_profile_id", "cv")})`,
    },
    follow_ups: { create: required("applications", "application_id", "application"), update: requiredUpdate("applications", "application_id", "application") },
    saved_searches: { create: optional("cv_profiles", "cv_profile_id", "cv"), update: optionalUpdate("cv_profiles", "cv_profile_id", "cv") },
    coach_threads: { create: optional("applications", "application_id", "application"), update: optionalUpdate("applications", "application_id", "application") },
    coach_messages: { create: required("coach_threads", "thread_id", "thread"), update: requiredUpdate("coach_threads", "thread_id", "thread") },
    application_events: { create: required("applications", "application_id", "application"), update: requiredUpdate("applications", "application_id", "application") },
  };

  [
    "profiles", "cv_profiles", "jobs", "applications", "application_kits", "star_stories",
    "follow_ups", "company_targets", "saved_searches", "coach_threads", "coach_messages", "application_events",
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
});
