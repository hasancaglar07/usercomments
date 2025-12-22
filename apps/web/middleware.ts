import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth-cookies";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/user/login";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // We only check if a token exists. Specific role-based access (admin, etc.) 
  // is handled by the API and the client pages, as roles are stored in the 
  // database and are not always present in the JWT.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/node/add/review", "/user/settings"],
};
