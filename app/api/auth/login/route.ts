import { NextResponse } from "next/server";
import { z } from "zod";
import { createRawClient } from "@/lib/pocketbase/compat";
import { PB_AUTH_COOKIE, sessionCookieOptions } from "@/lib/pocketbase/server";

const schema = z.object({ email: z.string().email().max(320), password: z.string().min(8).max(256) });

export async function POST(request: Request) {
  try {
    const { email, password } = schema.parse(await request.json());
    const pb = createRawClient();
    const auth = await pb.collection("users").authWithPassword(email.trim().toLowerCase(), password);
    const response = NextResponse.json({ user: { id: auth.record.id, email: auth.record.email } });
    response.cookies.set(PB_AUTH_COOKIE, auth.token, sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
}
