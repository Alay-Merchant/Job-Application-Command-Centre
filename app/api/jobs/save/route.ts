import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";

const schema = z.object({
  source: z.enum(["adzuna", "manual"]),
  external_id: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  company: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  salary_min: z.number().nonnegative().optional().nullable(),
  salary_max: z.number().nonnegative().optional().nullable(),
  currency: z.string().length(3).optional(),
  url: z.string().url().optional().nullable(),
  raw: z.unknown().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  try {
    const job = schema.parse(await request.json());
    const payload = { ...job, user_id: auth.user.id, external_id: job.external_id?.trim() || "" };
    // PocketBase intentionally does not make blank external IDs unique. A manual
    // role therefore must always be a new record rather than an accidental upsert.
    const query = payload.external_id
      ? auth.pb.from("jobs").upsert(payload, { onConflict: "user_id,source,external_id" })
      : auth.pb.from("jobs").insert(payload);
    const { data, error } = await query.select().single();
    if (error || !data) throw error || new Error("Could not save job.");
    return NextResponse.json({ job: data });
  } catch (error) {
    return apiError(error);
  }
}
