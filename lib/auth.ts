import { NextResponse } from "next/server";
import { createClient } from "@/lib/pocketbase/server";

export async function requireUser() {
  const pb = await createClient();
  const { data: { user }, error } = await pb.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) } as const;
  return { pb, user } as const;
}
export function apiError(error: unknown, status = 400) { return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status }); }
