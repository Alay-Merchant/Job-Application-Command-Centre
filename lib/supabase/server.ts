import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder", {
    cookies: { getAll() { return store.getAll(); }, setAll(values: any[]) { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Server Components cannot persist cookies. */ } } }
  });
}
