/// <reference path="../pb_data/types.d.ts" />

// Session validation calls PocketBase auth-refresh on ordinary page loads. A
// blanket *:auth limit would sign an active user out after normal navigation,
// so limit the password endpoint instead.
migrate((app) => {
  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [
    { label: "/api/collections/users/auth-with-password", audience: "", duration: 60, maxRequests: 10 },
    { label: "*:create", audience: "", duration: 60, maxRequests: 60 },
    { label: "/api/", audience: "", duration: 60, maxRequests: 300 },
  ];
  app.save(settings);
});
