
const IMAGE_OPTIMIZER = process.env.NEXT_PUBLIC_IMAGE_OPTIMIZER ?? "wsrv";
const IMAGE_CDN_BASE_URL =
  process.env.NEXT_PUBLIC_IMAGE_CDN_BASE_URL?.replace(/\/$/, "") ?? "";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://userreview.net";

function isOptimizableUrl(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return false;
  }
  if (url.includes("wsrv.nl")) {
    return false;
  }
  if (url.includes("/cdn-cgi/image/")) {
    return false;
  }
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    return false;
  }
  return true;
}

function buildCloudflareImageUrl(url: string, width: number, quality: number): string {
  if (!IMAGE_CDN_BASE_URL) {
    return url;
  }
  const widthValue = Math.max(1, Math.floor(width));
  const qualityValue = Math.max(30, Math.min(quality, 90));
  const params = [`width=${widthValue}`, `quality=${qualityValue}`, "format=auto"];
  return `${IMAGE_CDN_BASE_URL}/cdn-cgi/image/${params.join(",")}/${url}`;
}

export function getOptimizedImageUrl(
  url: string | undefined,
  width: number = 800,
  quality: number = 80
): string {
  if (!url) {
    return "";
  }

  let targetUrl = url;
  if (url.startsWith("/")) {
    targetUrl = `${SITE_URL}${url}`;
  }

  if (!isOptimizableUrl(targetUrl)) {
    return url;
  }

  if (IMAGE_OPTIMIZER === "cloudflare") {
    // For Cloudflare, we usually need the original path or full URL depending on setup.
    // Assuming Cloudflare setup handles full URLs or relative paths if strictly configured.
    // For now, passing original `url` works if it matches pattern.
    return buildCloudflareImageUrl(url, width, quality);
  }

  // wsrv.nl provides free resizing + compression (WebP/AVIF) for remote images.
  try {
    // Ensure we have a valid absolute URL for wsrv
    const urlObj = new URL(targetUrl);
    const encodedUrl = encodeURIComponent(urlObj.href);
    return `https://wsrv.nl/?url=${encodedUrl}&w=${width}&q=${quality}&output=webp&il`;
  } catch {
    return url;
  }
}
