import "server-only";
import { createClient } from "@supabase/supabase-js";

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder", { auth: { autoRefreshToken: false, persistSession: false } });
