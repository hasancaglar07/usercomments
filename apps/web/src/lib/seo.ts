import type { Metadata } from "next";

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
  type?: "website" | "article";
  image?: string;
};

export function buildMetadata(options: MetadataOptions): Metadata {
  const description = options.description ?? DEFAULT_DESCRIPTION;
  const url = toAbsoluteUrl(options.path);
  const imageUrl = toAbsoluteUrl(options.image ?? DEFAULT_OG_IMAGE);
  const title = `${options.title} | ${DEFAULT_SITE_NAME} | Real User Reviews & Honest Product Comments`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
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
