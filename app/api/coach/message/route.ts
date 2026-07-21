import OpenAI from "openai";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/auth";
import { coachSystem } from "@/lib/prompts";
import { allowAiRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ threadId: z.string().regex(/^[a-z0-9]{15}$/i), message: z.string().min(1).max(5000) });

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { threadId, message } = schema.parse(await request.json());
    const { data: thread } = await auth.pb
      .from("coach_threads")
      .select("*,application:applications(job:jobs(*),cv:cv_profiles(*))")
      .eq("id", threadId)
      .eq("user_id", auth.user.id)
      .single();
    if (!thread) throw new Error("Conversation not found.");
    if (!allowAiRequest(auth.user.id, 40)) return new Response("Daily AI generation limit reached.", { status: 429 });

    const { data: messages } = await auth.pb.from("coach_messages").select("role,content").eq("thread_id", threadId).eq("user_id", auth.user.id).order("created_at").limit(14);
    await auth.pb.from("coach_messages").insert({ user_id: auth.user.id, thread_id: threadId, role: "user", content: message });
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");

    const application = thread.application as { job?: unknown; cv?: { structured?: unknown } } | null;
    const context = application ? `\nApplication context: CV ${JSON.stringify(application.cv?.structured || {})}; job ${JSON.stringify(application.job || {})}` : "";
    const priorMessages = (messages || []) as Array<{ role: "user" | "assistant"; content: string }>;
    const stream = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: coachSystem + context },
        ...priorMessages.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: message },
      ],
    });

    let result = "";
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            result += text;
            controller.enqueue(encoder.encode(text));
          }
          await auth.pb.from("coach_messages").insert({ user_id: auth.user.id, thread_id: threadId, role: "assistant", content: result });
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (error) {
    return apiError(error);
  }
}
