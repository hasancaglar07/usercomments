const allowMockFallback =
  process.env.NEXT_PUBLIC_ALLOW_MOCK_FALLBACK === "true" &&
  process.env.NODE_ENV !== "production";

export { allowMockFallback };
