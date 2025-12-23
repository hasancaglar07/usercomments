import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth-cookies";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  localizePath,
} from "@/src/lib/i18n";

const PUBLIC_FILE = /\.(.*)$/;
const GLOBAL_PATHS = new Set(["/robots.txt", "/sitemap.xml"]);

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/stitch_assets") ||
    PUBLIC_FILE.test(pathname)
  );
}

function isGlobalRoute(pathname: string): boolean {
  if (GLOBAL_PATHS.has(pathname)) {
    return true;
  }
  if (pathname.startsWith("/sitemap-") && pathname.endsWith(".xml")) {
    return true;
  }
  return false;
}

function stripUnknownLangPrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return pathname;
  }
  const [first, ...rest] = segments;
  if (first.length === 2 && !isSupportedLanguage(first)) {
    const restPath = rest.length > 0 ? `/${rest.join("/")}` : "/";
    return restPath;
  }
  return pathname;
}

function isProtectedPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return false;
  }
  const [first, ...rest] = segments;
  const suffix = isSupportedLanguage(first) ? `/${rest.join("/")}` : pathname;

  if (suffix === "/admin" || suffix.startsWith("/admin/")) {
    return true;
  }
  if (suffix === "/node/add/review") {
    return true;
  }
  if (suffix === "/user/settings") {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicAsset(pathname) || isGlobalRoute(pathname)) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const maybeLang = segments[0];
  const isLang = isSupportedLanguage(maybeLang);

  if (!isLang) {
    const cleanedPath = stripUnknownLangPrefix(pathname);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizePath(
      cleanedPath === "" ? "/" : cleanedPath,
      DEFAULT_LANGUAGE
    );
    return NextResponse.redirect(redirectUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-lang", maybeLang);

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = localizePath("/user/login", maybeLang);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // We only check if a token exists. Specific role-based access (admin, etc.)
  // is handled by the API and the client pages, as roles are stored in the
  // database and are not always present in the JWT.
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/:path*"],
};
