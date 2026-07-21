import { NextResponse } from "next/server";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { requireUser, apiError } from "@/lib/auth";
import { cvSchema } from "@/lib/schemas";
import { parseCvPrompt } from "@/lib/prompts";
import { structured } from "@/lib/openai";
import { allowAiRequest } from "@/lib/rate-limit";
import { normalisePbRecord } from "@/lib/pocketbase/compat";
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
    const created = await auth.pb.raw.collection("cv_profiles").create({ user_id: auth.user.id, label, source: "upload", raw_text: rawText.slice(0, 50000), structured: parsed });
    try {
      const updated = await auth.pb.raw.collection("cv_profiles").update(created.id, { file_path: file });
      return NextResponse.json({ cv: normalisePbRecord(updated) });
    } catch (error) {
      await auth.pb.raw.collection("cv_profiles").delete(created.id).catch(() => undefined);
      throw error;
    }
  } catch (error) { return apiError(error); }
}
