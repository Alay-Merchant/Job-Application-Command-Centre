import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";
import { cvSchema } from "@/lib/schemas";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().regex(/^[a-z0-9]{15}$/i).optional(),
  label: z.string().min(1).max(80),
  target_role: z.string().max(140).optional().nullable(),
  is_default: z.boolean().optional(),
  source: z.enum(["manual", "linkedin", "upload"]).optional(),
  raw_text: z.string().max(40000).optional().nullable(),
  structured: cvSchema.optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const body = schema.parse(await request.json());
    if (body.is_default) {
      await auth.pb.from("cv_profiles").update({ is_default: false }).eq("user_id", auth.user.id);
    }

    const base = body.id
      ? body
      : {
          ...body,
          structured: body.source === "manual"
            ? { summary: body.raw_text || "", skills: [], experience: [], education: [], certifications: [], keywords: [], projects: [] }
            : body.structured,
        };
    const query = body.id
      ? auth.pb.from("cv_profiles").update({ ...base, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", auth.user.id)
      : auth.pb.from("cv_profiles").insert({ ...base, user_id: auth.user.id });
    const { data, error } = await query.select().single();
    if (error) throw error;
    return NextResponse.json({ cv: data });
  } catch (error) {
    return apiError(error);
  }
}
