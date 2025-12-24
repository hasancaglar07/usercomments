
const IMAGE_OPTIMIZER = process.env.NEXT_PUBLIC_IMAGE_OPTIMIZER ?? "none";
const IMAGE_CDN_BASE_URL =
  process.env.NEXT_PUBLIC_IMAGE_CDN_BASE_URL?.replace(/\/$/, "") ?? "";

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
  if (!isOptimizableUrl(url)) {
    return url;
  }

  if (IMAGE_OPTIMIZER === "cloudflare") {
    return buildCloudflareImageUrl(url, width, quality);
  }
  if (IMAGE_OPTIMIZER === "none") {
    return url;
  }

  // wsrv.nl provides free resizing + compression (WebP/AVIF) for remote images.
  try {
    const urlObj = new URL(url);
    const encodedUrl = encodeURIComponent(urlObj.href);
    return `https://wsrv.nl/?url=${encodedUrl}&w=${width}&q=${quality}&output=webp&il`;
  } catch {
    return url;
  }
}
