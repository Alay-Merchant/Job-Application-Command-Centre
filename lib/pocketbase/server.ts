import { cookies } from "next/headers";
import { createRawClient, normalisePbRecord, PocketBaseDb } from "@/lib/pocketbase/compat";

export const PB_AUTH_COOKIE = "applied_pb_auth";

export async function createClient() {
  const token = (await cookies()).get(PB_AUTH_COOKIE)?.value;
  const pb = createRawClient(token);
  if (!token) return new PocketBaseDb(pb);
  try {
    const refreshed = await pb.collection("users").authRefresh();
    return new PocketBaseDb(pb, normalisePbRecord(refreshed.record));
  } catch {
    pb.authStore.clear();
    return new PocketBaseDb(pb);
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 5,
  };
}
