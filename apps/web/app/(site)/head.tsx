function getOrigin(value?: string): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export default function Head() {
  const origins = new Set<string>();
  /* REMOVED: Custom font preloads to avoid double download / LCP blocking.
   * Browsers will download fonts as needed from CSS.
   */
  const fontPreloads: { href: string; type: string }[] = [];

  // Add Google Fonts domains to preconnect list
  const googleFontsOrigins = [
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com"
  ];

  googleFontsOrigins.forEach(origin => origins.add(origin));
  const apiOrigin = getOrigin(process.env.NEXT_PUBLIC_API_BASE_URL);
  const imageCdnOrigin = getOrigin(process.env.NEXT_PUBLIC_IMAGE_CDN_BASE_URL);
  const optimizer = process.env.NEXT_PUBLIC_IMAGE_OPTIMIZER ?? "none";
  const wsrvOrigin =
    optimizer !== "none" && optimizer !== "cloudflare" ? "https://wsrv.nl" : null;

  if (apiOrigin) {
    origins.add(apiOrigin);
  }
  if (imageCdnOrigin) {
    origins.add(imageCdnOrigin);
  }
  if (wsrvOrigin) {
    origins.add(wsrvOrigin);
  }

  const originList = Array.from(origins);

  return (
    <>
      {originList.map((origin) => (
        <link key={`${origin}-dns`} rel="dns-prefetch" href={origin} />
      ))}
      {originList.map((origin) => (
        <link
          key={`${origin}-preconnect`}
          rel="preconnect"
          href={origin}
          crossOrigin="anonymous"
        />
      ))}
      {fontPreloads.map((font) => (
        <link
          key={font.href}
          rel="preload"
          href={font.href}
          as="font"
          type={font.type}
          crossOrigin="anonymous"
        />
      ))}
    </>
  );
}
