import { NextResponse } from "next/server";
import { z } from "zod";
import { createRawClient, pocketBaseConnectionMessage } from "@/lib/pocketbase/compat";
import { PB_AUTH_COOKIE, sessionCookieOptions } from "@/lib/pocketbase/server";

const schema = z.object({ name: z.string().trim().min(1).max(160), email: z.string().email().max(320), password: z.string().min(8).max(256) });

export async function POST(request: Request) {
  try {
    const { name, email, password } = schema.parse(await request.json());
    const pb = createRawClient();
    const user = await pb.collection("users").create({ email: email.trim().toLowerCase(), password, passwordConfirm: password });
    const auth = await pb.collection("users").authWithPassword(email.trim().toLowerCase(), password);
    try {
      await pb.collection("profiles").create({ user_id: user.id, full_name: name, links: {}, preferences: { reminder_emails: true, job_alert_emails: true } });
    } catch (error) {
      await pb.collection("users").delete(user.id).catch(() => undefined);
      throw error;
    }
    const response = NextResponse.json({ user: { id: auth.record.id, email: auth.record.email } }, { status: 201 });
    response.cookies.set(PB_AUTH_COOKIE, auth.token, sessionCookieOptions());
    return response;
  } catch (error) {
    const backendMessage = pocketBaseConnectionMessage(error);
    if (backendMessage) return NextResponse.json({ error: backendMessage }, { status: 503 });
    const details = error as { message?: unknown; data?: { data?: { email?: { code?: unknown } } } };
    const message = typeof details.message === "string" ? details.message : "";
    const duplicateEmail = details.data?.data?.email?.code === "validation_not_unique" || /already exists|unique/i.test(message);
    const responseMessage = duplicateEmail
      ? "An account with that email already exists. Please sign in instead."
      : "Unable to create your account. Please check the details and try again.";
    return NextResponse.json({ error: responseMessage }, { status: 400 });
  }
}
