import type { Metadata } from "next";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  localizePath,
  type SupportedLanguage,
} from "@/src/lib/i18n";

const DEFAULT_SITE_NAME = "UserComments.net";
const DEFAULT_DESCRIPTION =
  "Read what real people say before you buy. Thousands of user comments and honest experiences on the latest products.";
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
  const description = options.description ?? DEFAULT_DESCRIPTION;
  const alternates = buildAlternates({
    lang: options.lang,
    path: options.path,
    languagePaths: options.languagePaths,
  });
  const url = (alternates?.canonical as string) ?? toAbsoluteUrl(options.path);
  const imageUrl = toAbsoluteUrl(options.image ?? DEFAULT_OG_IMAGE);
  const title = `${options.title} | ${DEFAULT_SITE_NAME} | Real User Reviews & Honest Product Comments`;

  return {
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
