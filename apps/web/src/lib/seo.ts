import type { Metadata } from "next";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLocale,
  localizePath,
  type SupportedLanguage,
} from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

const DEFAULT_SITE_NAME = "UserReview";
const DEFAULT_OG_IMAGE = "/stitch_assets/images/img-029.png";

export function getSiteUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export function toAbsoluteUrl(path: string): string {
  return new URL(path, getSiteUrl()).toString();
}

type MetadataOptions = {
  title: string;
  description?: string;
  path: string;
  lang: SupportedLanguage;
  type?: "website" | "article";
  image?: string;
  languagePaths?: Partial<Record<SupportedLanguage, string>>;
};

function buildAlternates({
  lang,
  path,
  languagePaths,
}: {
  lang: SupportedLanguage;
  path: string;
  languagePaths?: Partial<Record<SupportedLanguage, string>>;
}): Metadata["alternates"] {
  const defaultPath = localizePath(
    languagePaths?.[DEFAULT_LANGUAGE] ?? path,
    DEFAULT_LANGUAGE
  );
  const canonicalPath = localizePath(languagePaths?.[lang] ?? path, lang);
  const languages = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((supportedLang) => {
      const customPath = languagePaths?.[supportedLang] ?? path;
      const localizedPath = localizePath(customPath, supportedLang);
      return [supportedLang, toAbsoluteUrl(localizedPath)];
    })
  );
  languages["x-default"] = toAbsoluteUrl(defaultPath);

  return {
    canonical: toAbsoluteUrl(canonicalPath),
    languages,
  };
}

export function buildMetadata(options: MetadataOptions): Metadata {
  const description = options.description ?? t(options.lang, "seo.defaultDescription");
  const alternates = buildAlternates({
    lang: options.lang,
    path: options.path,
    languagePaths: options.languagePaths,
  });
  const url = (alternates?.canonical as string) ?? toAbsoluteUrl(options.path);
  const imageUrl = toAbsoluteUrl(options.image ?? DEFAULT_OG_IMAGE);
  let metadataBase: URL | undefined;
  try {
    metadataBase = new URL(getSiteUrl());
  } catch {
    metadataBase = undefined;
  }
  const locale = getLocale(options.lang);
  const alternateLocales = SUPPORTED_LANGUAGES.filter(
    (lang) => lang !== options.lang
  ).map(getLocale);
  const titleSuffix = t(options.lang, "seo.titleSuffix");
  const title = `${options.title} | ${DEFAULT_SITE_NAME} | ${titleSuffix}`;

  return {
    metadataBase,
    title,
    description,
    alternates: {
      canonical: url,
      languages: alternates?.languages,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: DEFAULT_SITE_NAME,
      type: options.type ?? "website",
      locale,
      alternateLocale: alternateLocales.length > 0 ? alternateLocales : undefined,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
