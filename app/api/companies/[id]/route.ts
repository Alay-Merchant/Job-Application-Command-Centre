import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";

const schema = z.object({ status: z.enum(["suggested", "interested", "dismissed", "applied"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const { status } = schema.parse(await request.json());
    const { data, error } = await auth.pb.from("company_targets").update({ status }).eq("id", id).eq("user_id", auth.user.id).select().single();
    if (error || !data) throw error || new Error("Company not found.");
    return NextResponse.json({ company: data });
  } catch (error) {
    return apiError(error);
  }
}
