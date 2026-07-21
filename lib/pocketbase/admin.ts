import { createRawClient, PocketBaseDb } from "@/lib/pocketbase/compat";

export async function createAdminClient() {
  const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
  if (!email || !password) throw new Error("PocketBase superuser credentials are not configured.");
  const raw = createRawClient();
  await raw.collection("_superusers").authWithPassword(email, password);
  return new PocketBaseDb(raw);
}
