import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) } as const;
  return { supabase, user } as const;
}
export function apiError(error: unknown, status = 400) { return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status }); }
