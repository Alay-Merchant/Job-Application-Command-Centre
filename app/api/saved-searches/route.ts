import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";

const createSchema = z.object({
  label: z.string().min(1).max(100),
  query: z.string().max(120),
  where_location: z.string().max(120).nullable().optional(),
  min_salary: z.number().nonnegative().nullable().optional(),
  cv_profile_id: z.string().uuid().nullable().optional(),
});
const updateSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const body = createSchema.parse(await request.json());
    if (body.cv_profile_id) {
      const { data: cv } = await auth.supabase.from("cv_profiles").select("id").eq("id", body.cv_profile_id).eq("user_id", auth.user.id).single();
      if (!cv) throw new Error("CV profile not found.");
    }
    const { data: existing } = await auth.supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("query", body.query)
      .eq("where_location", body.where_location || "")
      .eq("cv_profile_id", body.cv_profile_id || "")
      .maybeSingle();
    if (existing) return NextResponse.json({ search: existing, existing: true });
    const { data, error } = await auth.supabase.from("saved_searches").insert({ ...body, user_id: auth.user.id, active: true }).select().single();
    if (error) throw error;
    return NextResponse.json({ search: data, existing: false });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { id, active } = updateSchema.parse(await request.json());
    const { data, error } = await auth.supabase.from("saved_searches").update({ active }).eq("id", id).eq("user_id", auth.user.id).select().single();
    if (error) throw error;
    return NextResponse.json({ search: data });
  } catch (error) {
    return apiError(error);
  }
}
