import { NextResponse, type NextRequest } from "next/server";

const cookieName = "applied_pb_auth";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/demo") {
    if (process.env.NODE_ENV === "development") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // The token is verified by the server component or route handler through
  // PocketBase's authRefresh call. Edge middleware only performs the fast
  // missing-cookie redirect and never trusts a token by itself.
  if (!request.cookies.get(cookieName)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*", "/cvs/:path*", "/jobs/:path*", "/applications/:path*", "/companies/:path*", "/coach/:path*", "/insights/:path*", "/settings/:path*", "/demo"] };
