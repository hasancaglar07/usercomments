export const SUPPORTED_LANGUAGES = ["tr", "en", "es", "de"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export function isSupportedLanguage(value?: string | null): value is SupportedLanguage {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export function normalizeLanguage(value?: string | null): SupportedLanguage {
  return isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function isRtlLanguage(lang: string): boolean {
  return lang === "ar";
}

export function localizePath(path: string, lang: string): string {
  if (!path.startsWith("/")) {
    return path;
  }
  return replaceLanguageInPath(path, lang);
}


export function replaceLanguageInPath(path: string, lang: string): string {
  if (!path.startsWith("/")) {
    return path;
  }

  const normalizedLang = normalizeLanguage(lang);
  const [pathnameWithQuery, hash] = path.split("#");
  const [pathname, query] = pathnameWithQuery.split("?");
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length > 0 && isSupportedLanguage(segments[0])) {
    segments[0] = normalizedLang;
  } else {
    segments.unshift(normalizedLang);
  }

  const localized = `/${segments.join("/")}`;
  const withQuery = query ? `${localized}?${query}` : localized;
  return hash ? `${withQuery}#${hash}` : withQuery;
}

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  tr: "tr-TR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
};

export function getLocale(lang: SupportedLanguage): string {
  return LOCALE_MAP[lang] ?? LOCALE_MAP[DEFAULT_LANGUAGE];
}
