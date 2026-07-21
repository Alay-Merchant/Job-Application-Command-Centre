import { NextResponse } from "next/server";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { requireUser, apiError } from "@/lib/auth";
import { cvSchema } from "@/lib/schemas";
import { parseCvPrompt } from "@/lib/prompts";
import { structured } from "@/lib/openai";
import { allowAiRequest } from "@/lib/rate-limit";
export const runtime = "nodejs";
const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
function hasExpectedFileSignature(mime: string, buffer: Buffer): boolean {
  if (mime === "application/pdf") return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
  if (mime.includes("wordprocessingml")) return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
  return !buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
}
export async function POST(request: Request) {
  const auth = await requireUser(); if ("error" in auth) return auth.error;
  try {
    const form = await request.formData(); const file = form.get("file"); const label = String(form.get("label") || "CV profile");
    if (!(file instanceof File)) throw new Error("Choose a CV file to upload.");
    if (!allowed.includes(file.type)) throw new Error("Upload a PDF, DOCX, or plain-text CV.");
    if (file.size > 5 * 1024 * 1024) throw new Error("CV files must be 5 MB or smaller.");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedFileSignature(file.type, buffer)) throw new Error("The file contents do not match the selected CV format.");
    const rawText = (file.type === "application/pdf" ? (await pdf(buffer)).text : file.type.includes("wordprocessingml") ? (await mammoth.extractRawText({ buffer })).value : buffer.toString("utf8")).slice(0, 40000);
    if (!rawText.trim()) throw new Error("We could not read any text from that file.");
    if (!allowAiRequest(auth.user.id)) return NextResponse.json({ error: "Daily AI generation limit reached. Please try again tomorrow." }, { status: 429 });
    const parsed = await structured(cvSchema, parseCvPrompt(rawText));
    const { data: cv, error: insertError } = await auth.supabase.from("cv_profiles").insert({ user_id: auth.user.id, label, source: "upload", raw_text: rawText.slice(0, 50000), structured: parsed }).select().single();
    if (insertError || !cv) throw insertError || new Error("Could not create CV profile.");
    const path = `${auth.user.id}/${cv.id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await auth.supabase.storage.from("cvs").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { await auth.supabase.from("cv_profiles").delete().eq("id", cv.id).eq("user_id", auth.user.id); throw uploadError; }
    const { data, error } = await auth.supabase.from("cv_profiles").update({ file_path: path }).eq("id", cv.id).eq("user_id", auth.user.id).select().single();
    if (error) throw error; return NextResponse.json({ cv: data });
  } catch (error) { return apiError(error); }
}
