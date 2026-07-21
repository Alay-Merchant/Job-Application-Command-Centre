import { NextResponse } from "next/server";

// Password authentication is handled through the secure Next.js auth routes.
// PocketBase OAuth, if enabled later, uses its own `/api/oauth2-redirect` flow.
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url));
}
