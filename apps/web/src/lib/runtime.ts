export const allowMockFallback =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ALLOW_MOCK_FALLBACK === "true";
