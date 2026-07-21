import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";

const schema = z.object({
  stage: z.enum(["saved", "applied", "phone_screen", "interview", "final", "offer", "rejected", "archived"]).optional(),
  board_order: z.number().optional(),
  cv_profile_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  next_action: z.string().max(500).nullable().optional(),
  next_action_due: z.string().date().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const changes = schema.parse(await request.json());
    if (changes.cv_profile_id) {
      const { data: cv } = await auth.supabase.from("cv_profiles").select("id").eq("id", changes.cv_profile_id).eq("user_id", auth.user.id).single();
      if (!cv) throw new Error("CV profile not found.");
    }
    const { data, error } = await auth.supabase
      .from("applications")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", auth.user.id)
      .select()
      .single();
    if (error || !data) throw error || new Error("Application not found.");

    // A new due date supersedes an open reminder; clearing it marks the reminder complete.
    if (Object.prototype.hasOwnProperty.call(changes, "next_action_due")) {
      const { error: completeError } = await auth.supabase
        .from("follow_ups")
        .update({ done: true })
        .eq("user_id", auth.user.id)
        .eq("application_id", params.id)
        .eq("done", false);
      if (completeError) throw completeError;
      if (changes.next_action_due) {
        const { error: followUpError } = await auth.supabase.from("follow_ups").upsert({
          user_id: auth.user.id,
          application_id: params.id,
          due_date: changes.next_action_due,
          note: changes.next_action || "Follow up",
          done: false,
          reminded_at: null,
        }, { onConflict: "application_id,due_date" });
        if (followUpError) throw followUpError;
      }
    }
    return NextResponse.json({ application: data });
  } catch (error) {
    return apiError(error);
  }
}
