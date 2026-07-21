/// <reference path="../pb_data/types.d.ts" />

// PocketBase exposes its own REST and auth endpoints, so throttling must live
// at the PocketBase layer rather than only in the Next.js route handlers.
migrate((app) => {
  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [
    // Do not throttle auth-refresh calls globally: Applied refreshes the
    // session on each server request. Target password login specifically.
    { label: "/api/collections/users/auth-with-password", audience: "", duration: 60, maxRequests: 10 },
    { label: "*:create", audience: "", duration: 60, maxRequests: 60 },
    { label: "/api/", audience: "", duration: 60, maxRequests: 300 },
  ];
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.rateLimits.enabled = false;
  app.save(settings);
});
