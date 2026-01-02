import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/src/lib/auth-cookies";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  localizePath,
  type SupportedLanguage,
} from "@/src/lib/i18n";

const PUBLIC_FILE = /\.(.*)$/;
const GLOBAL_PATHS = new Set(["/robots.txt", "/sitemap.xml", "/feed.xml"]);

const COUNTRY_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  TR: "tr",
  CY: "tr",
  DE: "de",
  AT: "de",
  CH: "de",
  LI: "de",
  LU: "de",
  ES: "es",
  MX: "es",
  AR: "es",
  CL: "es",
  CO: "es",
  PE: "es",
  VE: "es",
  EC: "es",
  GT: "es",
  CU: "es",
  BO: "es",
  DO: "es",
  HN: "es",
  PY: "es",
  SV: "es",
  NI: "es",
  CR: "es",
  PA: "es",
  UY: "es",
  PR: "es",
  GQ: "es",
};

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

function parseAcceptLanguage(value: string | null): SupportedLanguage | null {
  if (!value) {
    return null;
  }

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  let bestLang: SupportedLanguage | null = null;
  let bestQuality = -1;

  for (const entry of entries) {
    const [range, ...params] = entry.split(";");
    const primary = range.toLowerCase().split("-")[0];

    if (!isSupportedLanguage(primary)) {
      continue;
    }

    let quality = 1;
    for (const param of params) {
      const trimmed = param.trim();
      if (trimmed.startsWith("q=")) {
        const parsed = Number.parseFloat(trimmed.slice(2));
        if (!Number.isNaN(parsed)) {
          quality = parsed;
        }
        break;
      }
    }

    if (quality > bestQuality) {
      bestLang = primary;
      bestQuality = quality;
    }
  }

  return bestLang;
}

function getCountryFromRequest(request: NextRequest): string | null {
  return (
    request.geo?.country ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    null
  );
}

function resolvePreferredLanguage(request: NextRequest): SupportedLanguage {
  const acceptLanguage = request.headers.get("accept-language");
  const headerLang = parseAcceptLanguage(acceptLanguage);
  if (headerLang) {
    return headerLang;
  }

  const country = getCountryFromRequest(request);
  if (country) {
    const mapped = COUNTRY_LANGUAGE_MAP[country.toUpperCase()];
    if (mapped) {
      return mapped;
    }
  }

  return DEFAULT_LANGUAGE;
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
    const preferredLang = resolvePreferredLanguage(request);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizePath(
      cleanedPath === "" ? "/" : cleanedPath,
      preferredLang
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
