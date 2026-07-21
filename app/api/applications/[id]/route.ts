import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";

const schema = z.object({
  stage: z.enum(["saved", "applied", "phone_screen", "interview", "final", "offer", "rejected", "archived"]).optional(),
  board_order: z.number().optional(),
  cv_profile_id: z.string().regex(/^[a-z0-9]{15}$/i).nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  next_action: z.string().max(500).nullable().optional(),
  next_action_due: z.string().date().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const changes = schema.parse(await request.json());
    const { data: current } = await auth.pb
      .from("applications")
      .select("id,stage,applied_at")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .single();
    if (!current) throw new Error("Application not found.");
    if (changes.cv_profile_id) {
      const { data: cv } = await auth.pb.from("cv_profiles").select("id").eq("id", changes.cv_profile_id).eq("user_id", auth.user.id).single();
      if (!cv) throw new Error("CV profile not found.");
    }
    const stageChanged = Boolean(changes.stage && changes.stage !== current.stage);
    const applicationChanges = {
      ...changes,
      ...(changes.stage === "applied" && !current.applied_at ? { applied_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await auth.pb
      .from("applications")
      .update(applicationChanges)
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select()
      .single();
    if (error || !data) throw error || new Error("Application not found.");

    if (stageChanged) {
      const { error: eventError } = await auth.pb.from("application_events").insert({
        user_id: auth.user.id,
        application_id: id,
        from_stage: current.stage,
        to_stage: changes.stage,
        at: new Date().toISOString(),
      });
      if (eventError) throw eventError;
    }

    // A new due date supersedes an open reminder; clearing it marks the reminder complete.
    if (Object.prototype.hasOwnProperty.call(changes, "next_action_due")) {
      const { error: completeError } = await auth.pb
        .from("follow_ups")
        .update({ done: true })
        .eq("user_id", auth.user.id)
        .eq("application_id", id)
        .eq("done", false);
      if (completeError) throw completeError;
      if (changes.next_action_due) {
        const { error: followUpError } = await auth.pb.from("follow_ups").upsert({
          user_id: auth.user.id,
          application_id: id,
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
