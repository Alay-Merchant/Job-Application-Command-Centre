import { NextResponse } from "next/server";
import { PB_AUTH_COOKIE } from "@/lib/pocketbase/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PB_AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
