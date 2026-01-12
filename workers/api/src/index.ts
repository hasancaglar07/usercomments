import { z, ZodError } from "zod";
import { getEnv, type Env, type ParsedEnv } from "./env";
import { getAuthUser, hasRole, type AuthUser } from "./auth";
import { cacheResponse, purgeCacheUrls } from "./utils/cache";
import { checkRateLimit, getClientIp } from "./utils/rateLimit";
import {
  buildPaginationInfo,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "./utils/pagination";
import {
  createCategory,
  fetchCategories,
  fetchCategoryTranslations,
  fetchSubcategories,
  upsertCategoryTranslations,
  updateCategory,
} from "./services/categories";
import {
  addComment,
  addVote,
  createReview,
  fetchCommentStatusById,
  fetchLatestComments,
  fetchHomepageLatestReviews,
  fetchHomepagePopularReviews,
  fetchLatestReviews,
  fetchPopularReviews,
  fetchReviewBySlug,
  fetchReviewComments,
  fetchReviewMetaById,
  fetchReviews,
  fetchReviewsByUserId,
  fetchReviewsByUserComments,
  fetchSavedReviews,
  incrementReviewViews,
} from "./services/reviews";
import {
  createAdminProduct,
  fetchAdminProductDetail,
  fetchAdminProducts,
  fetchProductBySlug,
  fetchProductTranslations,
  fetchProducts,
  searchProductSuggestions,
  searchProducts,
  upsertProductTranslations,
  updateAdminProduct,
} from "./services/products";
import { searchReviews, searchReviewSuggestions } from "./services/search";
import { fetchUserProfileRecord } from "./services/users";
import { createPresignedUploadUrl } from "./services/uploads";
import { fetchLeaderboard, refreshLeaderboardStats } from "./services/leaderboard";
import { fetchFollowingUsers, followUser, unfollowUser } from "./services/follows";
import {
  blockUser as blockUserRelation,
  fetchBlockedUsers,
  isBlockedBetween,
  unblockUser as unblockUserRelation,
} from "./services/blocks";
import {
  createReport,
  fetchReports,
  updateReportStatus,
} from "./services/reports";
import {
  createDirectMessage,
  fetchConversationById,
  fetchMessageThreads,
  fetchThreadMessages,
  getOrCreateConversation,
} from "./services/messages";
import {
  fetchAdminComments,
  fetchAdminReviewDetail,
  fetchAdminReviews,
  fetchAdminUserDetail,
  fetchAdminUsers,
  updateAdminComment,
  updateAdminReview,
} from "./services/admin";
import {
  fetchProfileByUserId,
  fetchProfileDetailsByUserId,
  updateProfileByUserId,
} from "./services/profiles";
import {
  updateCommentStatus,
  updateReviewStatus,
  updateUserRole,
} from "./services/moderation";
import {
  fetchSitemapCategories,
  fetchSitemapProductCount,
  fetchSitemapProducts,
  fetchSitemapReviewCount,
  fetchSitemapReviews,
} from "./services/sitemap";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage, isSupportedLanguage } from "./utils/i18n";
import type { HomepagePayload, UploadHealth, UserProfile } from "./types";
import { hashString } from "./utils/crypto";

const MAX_SITEMAP_PAGE_SIZE = 50000;
const HOMEPAGE_DEFAULT_LIMIT = 9;
const R2_ENV_KEYS = [
  "R2_ENDPOINT",
  "R2_REGION",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

class HttpError extends Error {
  status: number;
  details?: unknown;
  headers?: HeadersInit;

  constructor(
    status: number,
    message: string,
    details?: unknown,
    headers?: HeadersInit
  ) {
    super(message);
    this.status = status;
    this.details = details;
    this.headers = headers;
  }
}

type HandlerContext = {
  request: Request;
  url: URL;
  params: Record<string, string>;
  env: ParsedEnv;
  ctx: ExecutionContext;
};

type Handler = (context: HandlerContext) => Promise<Response>;

type Route = {
  method: string;
  pattern: URLPattern;
  handler: Handler;
  cacheTtl?: (env: ParsedEnv) => number;
  noStore?: boolean;
};

const limitSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(MAX_PAGE_SIZE)
  .default(DEFAULT_PAGE_SIZE);

const LEADERBOARD_MAX_PAGE_SIZE = 100;
const leaderboardPageSizeSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(LEADERBOARD_MAX_PAGE_SIZE)
  .default(DEFAULT_PAGE_SIZE);

const langSchema = z
  .string()
  .optional()
  .transform((value) => normalizeLanguage(value));

const photoOnlySchema = z.preprocess(
  (value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
      }
      if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
      }
    }
    return undefined;
  },
  z.boolean().optional()
);

const supportedLangSchema = z.enum(SUPPORTED_LANGUAGES);

function buildUploadHealth(env: ParsedEnv): UploadHealth {
  const missing = R2_ENV_KEYS.filter((key) => !env[key]);
  const configured = missing.length === 0;
  return {
    ok: configured,
    checks: {
      r2: {
        configured,
        missing,
      },
    },
  };
}

const cursorSchema = z
  .string()
  .optional()
  .refine((value) => {
    if (!value) {
      return true;
    }
    const [datePart, idPart] = value.split("|");
    if (Number.isNaN(Date.parse(datePart))) {
      return false;
    }
    if (idPart) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idPart
      );
    }
    return true;
  }, {
    message: "cursor must be a valid date string",
  });

const popularQuerySchema = z.object({
  limit: limitSchema,
  lang: langSchema,
  timeWindow: z.enum(["6h", "24h", "week"]).optional(),
});

const latestQuerySchema = z.object({
  cursor: cursorSchema,
  limit: limitSchema,
  lang: langSchema,
});

const homepageQuerySchema = z.object({
  latestLimit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(HOMEPAGE_DEFAULT_LIMIT),
  popularLimit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(HOMEPAGE_DEFAULT_LIMIT),
  lang: langSchema,
  timeWindow: z.enum(["6h", "24h", "week"]).optional(),
});

const leaderboardQuerySchema = z.object({
  metric: z.enum(["active", "helpful", "trending"]).default("active"),
  timeframe: z.enum(["all", "month", "week"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: leaderboardPageSizeSchema,
  lang: langSchema,
});

const listQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  subCategoryId: z.coerce.number().int().positive().optional(),
  photoOnly: photoOnlySchema,
  sort: z.enum(["latest", "popular", "rating"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  lang: langSchema,
});

const productListQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  sort: z.enum(["latest", "popular", "rating"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  lang: langSchema,
});

const productReviewQuerySchema = z.object({
  sort: z.enum(["latest", "popular", "rating"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  lang: langSchema,
});

const productSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().max(20).default(8),
  includePending: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  lang: langSchema,
});

const slugParamSchema = z.object({
  slug: z.string().min(1),
});

const reviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

const productIdParamSchema = z.object({
  id: z.string().uuid(),
});

const commentIdParamSchema = z.object({
  id: z.string().uuid(),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

const commentQuerySchema = z.object({
  cursor: cursorSchema,
  limit: limitSchema,
});

const cachePurgeSchema = z.object({
  reviewId: z.string().uuid(),
});

const createReviewSchema = z
  .object({
    title: z.string().min(3),
    excerpt: z.string().min(10),
    contentHtml: z.string().min(10),
    rating: z.number().min(0).max(5),
    recommend: z.boolean().optional(),
    pros: z.array(z.string().min(1)).max(20).optional(),
    cons: z.array(z.string().min(1)).max(20).optional(),
    categoryId: z.number().int().positive(),
    subCategoryId: z.number().int().positive().optional(),
    productId: z.string().uuid().optional(),
    productName: z.string().min(2).optional(),
    photoUrls: z.array(z.string().url()).default([]),
    productPhotoUrl: z.string().url().optional(),
    lang: langSchema,
  })
  .refine((value) => value.productId || value.productName, {
    message: "Product selection is required.",
  });

const createCommentSchema = z.object({
  text: z.string().min(1).max(2000),
});

const voteSchema = z.object({
  type: z.enum(["up", "down"]).default("up"),
});

const reportBodySchema = z.object({
  reason: z.string().min(3).max(200),
  details: z.string().max(1000).optional(),
});

const reportQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["open", "resolved", "rejected"]).optional(),
  targetType: z.enum(["review", "comment", "user"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

const reportStatusSchema = z.object({
  status: z.enum(["resolved", "rejected"]),
});

const reviewStatusSchema = z.object({
  status: z.enum(["published", "hidden", "deleted", "pending", "draft"]),
});

const productStatusSchema = z.enum([
  "published",
  "hidden",
  "deleted",
  "pending",
]);

const commentStatusSchema = z.object({
  status: z.enum(["published", "hidden", "deleted"]),
});

const userRoleSchema = z.object({
  role: z.enum(["user", "moderator", "admin"]),
});

const adminReviewQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["published", "hidden", "deleted", "pending", "draft"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  lang: langSchema,
});

const adminProductQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: productStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  lang: langSchema,
});

const adminProductCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  status: productStatusSchema.optional(),
  brandId: z.string().uuid().optional().nullable(),
  categoryIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
  imageUrls: z.array(z.string().url()).max(20).optional(),
});

const adminProductUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    status: productStatusSchema.optional(),
    brandId: z.string().uuid().optional().nullable(),
    categoryIds: z.array(z.coerce.number().int().positive()).max(50).optional().nullable(),
    imageUrls: z.array(z.string().url()).max(20).optional().nullable(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.status !== undefined ||
      value.brandId !== undefined ||
      value.categoryIds !== undefined ||
      value.imageUrls !== undefined,
    "At least one field is required."
  );

const categoryTranslationSchema = z.object({
  lang: supportedLangSchema,
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().optional().nullable(),
});

const categoryTranslationsSchema = z.object({
  translations: z.array(categoryTranslationSchema).min(1),
});

const productTranslationSchema = z.object({
  lang: supportedLangSchema,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  metaTitle: z.string().trim().max(160).optional().nullable(),
  metaDescription: z.string().trim().max(300).optional().nullable(),
});

const productTranslationsSchema = z.object({
  translations: z.array(productTranslationSchema).min(1),
});

const adminReviewUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    excerpt: z.string().trim().min(10).max(300).optional(),
    contentHtml: z.string().min(10).optional(),
    photoUrls: z.array(z.string().url()).optional(),
    recommend: z.boolean().optional(),
    pros: z.array(z.string().min(1)).max(20).optional(),
    cons: z.array(z.string().min(1)).max(20).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    subCategoryId: z.coerce.number().int().positive().nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.excerpt !== undefined ||
      value.contentHtml !== undefined ||
      value.photoUrls !== undefined ||
      value.recommend !== undefined ||
      value.pros !== undefined ||
      value.cons !== undefined ||
      value.categoryId !== undefined ||
      value.subCategoryId !== undefined ||
      value.productId !== undefined,
    "At least one field is required."
  );

const adminCommentQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["published", "hidden", "deleted"]).optional(),
  reviewId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

const adminCommentUpdateSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

const adminUserQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

const userListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  lang: langSchema,
});

const followListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(MAX_PAGE_SIZE),
  usernames: z
    .string()
    .optional()
    .transform((value) =>
      value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []
    ),
});

const blockListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(MAX_PAGE_SIZE),
  usernames: z
    .string()
    .optional()
    .transform((value) =>
      value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []
    ),
});

const messageThreadQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

const messageCreateSchema = z.object({
  username: z.string().trim().min(1),
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(1000),
});

const conversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

const adminCategoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  parentId: z.number().int().positive().nullable().optional(),
});

const adminCategoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    parentId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.parentId !== undefined,
    "At least one field is required."
  );

const profilePicUrlSchema = z.union([
  z.string().url(),
  z.string().regex(/^\/profile_icon\//),
]);

const profileUpdateSchemaBase = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_-]+$/i, "username must be alphanumeric with - or _.")
    .optional(),
  bio: z.string().trim().max(280).optional().nullable(),
  profilePicUrl: profilePicUrlSchema.optional().nullable(),
});

const profileUpdateSchema = profileUpdateSchemaBase.refine(
  (value) =>
    value.username !== undefined ||
    value.bio !== undefined ||
    value.profilePicUrl !== undefined,
  "At least one field is required."
);

const adminProfileUpdateSchema = profileUpdateSchemaBase
  .extend({
    isVerified: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.username !== undefined ||
      value.bio !== undefined ||
      value.profilePicUrl !== undefined ||
      value.isVerified !== undefined,
    "At least one field is required."
  );

const searchQuerySchema = z.object({
  q: z.string().trim().optional().default(""),
  categoryId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  lang: langSchema,
});

const searchSuggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  limit: z.coerce.number().int().positive().max(12).default(8),
  lang: langSchema,
});

const presignSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

const sitemapReviewsQuerySchema = z.object({
  part: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_SITEMAP_PAGE_SIZE)
    .default(5000),
  lang: langSchema,
  countOnly: z.string().optional().transform((val) => val === "true"),
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function xmlResponse(body: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/xml; charset=utf-8");
  return new Response(body, { ...init, headers });
}

function errorResponse(
  status: number,
  message: string,
  details?: unknown,
  headers?: HeadersInit
): Response {
  const body: Record<string, unknown> = { error: message };
  if (details !== undefined) {
    body.details = details;
  }
  return jsonResponse(body, { status, headers });
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.body) {
    return {};
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

function getQueryObject(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

function applyCors(response: Response, request?: Request): Response {
  const origin = request?.headers.get("Origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  } else {
    response.headers.set("Access-Control-Allow-Origin", "*");
  }

  response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, x-request-id, sentry-trace, baggage"
  );
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function handleOptions(request: Request): Response {
  const response = new Response(null, { status: 204 });
  return applyCors(response, request);
}

function addRequestId(response: Response, requestId: string): Response {
  const next = new Response(response.body, response);
  next.headers.set("x-request-id", requestId);
  return next;
}

function throwRateLimit(retryAfter: number): never {
  throw new HttpError(429, "Too Many Requests", undefined, {
    "Retry-After": String(retryAfter),
  });
}

function enforceRateLimit(
  request: Request,
  env: ParsedEnv,
  userId?: string
) {
  const pathKey = `${request.method}:${new URL(request.url).pathname}`;
  const ip = getClientIp(request);
  const ipResult = checkRateLimit(
    `ip:${ip}:${pathKey}`,
    env.RATE_LIMIT_MAX,
    env.RATE_LIMIT_WINDOW_SEC
  );
  if (!ipResult.allowed) {
    throwRateLimit(ipResult.retryAfter ?? env.RATE_LIMIT_WINDOW_SEC);
  }

  if (userId) {
    const userResult = checkRateLimit(
      `user:${userId}:${pathKey}`,
      env.RATE_LIMIT_MAX,
      env.RATE_LIMIT_WINDOW_SEC
    );
    if (!userResult.allowed) {
      const retryAfter = Math.max(
        ipResult.retryAfter ?? 0,
        userResult.retryAfter ?? env.RATE_LIMIT_WINDOW_SEC
      );
      throwRateLimit(retryAfter);
    }
  }
}

async function requireAuth(request: Request, env: ParsedEnv): Promise<AuthUser> {
  const user = await getAuthUser(request, env);
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }
  return user;
}

function requireRole(user: AuthUser, roles: AuthUser["role"] | AuthUser["role"][]) {
  if (!hasRole(user, roles)) {
    throw new HttpError(403, "Forbidden");
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlset(
  urls: Array<{
    loc: string;
    lastmod?: string;
    changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority?: number;
    images?: string[];
  }>
): string {
  const hasImages = urls.some((item) => item.images && item.images.length > 0);
  const entries = urls
    .map((item) => {
      const lastmod = item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : "";
      const changefreq = item.changefreq ? `<changefreq>${item.changefreq}</changefreq>` : "";
      const priority = item.priority !== undefined ? `<priority>${item.priority.toFixed(1)}</priority>` : "";
      const images = item.images?.length
        ? item.images
          .map(
            (image) =>
              `<image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`
          )
          .join("")
        : "";
      return `<url><loc>${escapeXml(item.loc)}</loc>${lastmod}${changefreq}${priority}${images}</url>`;
    })
    .join("");
  const imageNamespace = hasImages
    ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNamespace}>${entries}</urlset>`;
}

function buildSitemapIndex(urls: Array<string | { loc: string; lastmod?: string }>): string {
  const entries = urls
    .map((item) => {
      if (typeof item === "string") {
        return `<sitemap><loc>${escapeXml(item)}</loc></sitemap>`;
      }
      const lastmod = item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : "";
      return `<sitemap><loc>${escapeXml(item.loc)}</loc>${lastmod}</sitemap>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

const POPULAR_LIMITS = [3, 4, 6];
const LATEST_LIMITS = [3];
const HOMEPAGE_TIME_WINDOWS = ["6h", "24h", "week"] as const;
const WARMUP_REVIEW_SORTS = ["latest", "popular"] as const;
const PRODUCT_SORTS = ["latest", "popular", "rating"] as const;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE_CACHE = 10;

function buildApiUrl(origin: string, path: string, params?: URLSearchParams): string {
  const url = new URL(path, origin);
  if (params) {
    url.search = params.toString();
  }
  return url.toString();
}

function buildReviewCacheUrls(options: {
  origin: string;
  slug?: string;
  reviewId?: string;
  categoryId?: number | null;
  productId?: string | null;
  productSlug?: string | null;
  productTranslations?: { lang: string; slug: string }[];
  authorUsername?: string | null;
  translations?: { lang: string; slug: string }[];
}): string[] {
  const urls: string[] = [];
  const {
    origin,
    slug,
    reviewId,
    categoryId,
    productId,
    productSlug,
    productTranslations,
    authorUsername,
    translations,
  } = options;
  const languageSet = SUPPORTED_LANGUAGES;
  const translationEntries =
    translations && translations.length > 0
      ? translations
      : slug
        ? [{ lang: DEFAULT_LANGUAGE, slug }]
        : [];
  const productTranslationEntries =
    productTranslations && productTranslations.length > 0
      ? productTranslations
      : productSlug
        ? [{ lang: DEFAULT_LANGUAGE, slug: productSlug }]
        : [];

  translationEntries.forEach((entry) => {
    const params = new URLSearchParams({ lang: entry.lang });
    urls.push(buildApiUrl(origin, `/api/reviews/slug/${entry.slug}`, params));
    if (entry.lang === DEFAULT_LANGUAGE) {
      urls.push(buildApiUrl(origin, `/api/reviews/slug/${entry.slug}`));
    }
  });

  productTranslationEntries.forEach((entry) => {
    const params = new URLSearchParams({ lang: entry.lang });
    urls.push(buildApiUrl(origin, `/api/products/slug/${entry.slug}`, params));
    if (entry.lang === DEFAULT_LANGUAGE) {
      urls.push(buildApiUrl(origin, `/api/products/slug/${entry.slug}`));
    }
  });

  if (reviewId) {
    const params = new URLSearchParams({ limit: "10" });
    urls.push(buildApiUrl(origin, `/api/reviews/${reviewId}/comments`, params));
  }

  languageSet.forEach((lang) => {
    POPULAR_LIMITS.forEach((limit) => {
      const params = new URLSearchParams({ limit: String(limit), lang });
      urls.push(buildApiUrl(origin, "/api/reviews/popular", params));
      if (lang === DEFAULT_LANGUAGE) {
        urls.push(buildApiUrl(origin, "/api/reviews/popular", new URLSearchParams({ limit: String(limit) })));
      }
    });

    LATEST_LIMITS.forEach((limit) => {
      const params = new URLSearchParams({ limit: String(limit), lang });
      urls.push(buildApiUrl(origin, "/api/reviews/latest", params));
      if (lang === DEFAULT_LANGUAGE) {
        urls.push(buildApiUrl(origin, "/api/reviews/latest", new URLSearchParams({ limit: String(limit) })));
      }
    });

    const homepageParams = new URLSearchParams({
      latestLimit: String(HOMEPAGE_DEFAULT_LIMIT),
      popularLimit: String(HOMEPAGE_DEFAULT_LIMIT),
      lang,
    });
    urls.push(buildApiUrl(origin, "/api/homepage", homepageParams));
    HOMEPAGE_TIME_WINDOWS.forEach((timeWindow) => {
      const params = new URLSearchParams(homepageParams);
      params.set("timeWindow", timeWindow);
      urls.push(buildApiUrl(origin, "/api/homepage", params));
    });
    if (lang === DEFAULT_LANGUAGE) {
      const fallbackParams = new URLSearchParams({
        latestLimit: String(HOMEPAGE_DEFAULT_LIMIT),
        popularLimit: String(HOMEPAGE_DEFAULT_LIMIT),
      });
      urls.push(buildApiUrl(origin, "/api/homepage", fallbackParams));
      HOMEPAGE_TIME_WINDOWS.forEach((timeWindow) => {
        const params = new URLSearchParams(fallbackParams);
        params.set("timeWindow", timeWindow);
        urls.push(buildApiUrl(origin, "/api/homepage", params));
      });
    }

    const baseParams = new URLSearchParams({
      page: String(DEFAULT_PAGE),
      pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
      sort: "latest",
      lang,
    });
    urls.push(buildApiUrl(origin, "/api/reviews", baseParams));
    if (lang === DEFAULT_LANGUAGE) {
      const fallbackParams = new URLSearchParams({
        page: String(DEFAULT_PAGE),
        pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
        sort: "latest",
      });
      urls.push(buildApiUrl(origin, "/api/reviews", fallbackParams));
    }

    if (categoryId) {
      const categoryParams = new URLSearchParams(baseParams);
      categoryParams.set("categoryId", String(categoryId));
      urls.push(buildApiUrl(origin, "/api/reviews", categoryParams));
      urls.push(
        buildApiUrl(
          origin,
          `/api/categories/${categoryId}/subcategories`,
          new URLSearchParams({ lang })
        )
      );
      if (lang === DEFAULT_LANGUAGE) {
        const fallbackCategoryParams = new URLSearchParams({
          page: String(DEFAULT_PAGE),
          pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
          sort: "latest",
          categoryId: String(categoryId),
        });
        urls.push(buildApiUrl(origin, "/api/reviews", fallbackCategoryParams));
        urls.push(buildApiUrl(origin, `/api/categories/${categoryId}/subcategories`));
      }
    }

    urls.push(buildApiUrl(origin, "/api/categories", new URLSearchParams({ lang })));
    if (lang === DEFAULT_LANGUAGE) {
      urls.push(buildApiUrl(origin, "/api/categories"));
    }

    if (authorUsername) {
      const userParams = new URLSearchParams({
        page: String(DEFAULT_PAGE),
        pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
        lang,
      });
      urls.push(buildApiUrl(origin, `/api/users/${authorUsername}/reviews`, userParams));
      urls.push(buildApiUrl(origin, `/api/users/${authorUsername}/comments`, userParams));
      if (lang === DEFAULT_LANGUAGE) {
        const fallbackUserParams = new URLSearchParams({
          page: String(DEFAULT_PAGE),
          pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
        });
        urls.push(buildApiUrl(origin, `/api/users/${authorUsername}/reviews`, fallbackUserParams));
        urls.push(buildApiUrl(origin, `/api/users/${authorUsername}/comments`, fallbackUserParams));
      }
      urls.push(buildApiUrl(origin, `/api/users/${authorUsername}`));
    }

    if (productId) {
      PRODUCT_SORTS.forEach((sort) => {
        const params = new URLSearchParams({
          page: String(DEFAULT_PAGE),
          pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
          sort,
          lang,
        });
        urls.push(buildApiUrl(origin, `/api/products/${productId}/reviews`, params));
        if (lang === DEFAULT_LANGUAGE) {
          const fallbackParams = new URLSearchParams({
            page: String(DEFAULT_PAGE),
            pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
            sort,
          });
          urls.push(buildApiUrl(origin, `/api/products/${productId}/reviews`, fallbackParams));
        }
      });
    }

    if (productId || productTranslationEntries.length > 0) {
      PRODUCT_SORTS.forEach((sort) => {
        const baseParams = new URLSearchParams({
          page: String(DEFAULT_PAGE),
          pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
          sort,
          lang,
        });
        urls.push(buildApiUrl(origin, "/api/products", baseParams));
        if (lang === DEFAULT_LANGUAGE) {
          const fallbackParams = new URLSearchParams({
            page: String(DEFAULT_PAGE),
            pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
            sort,
          });
          urls.push(buildApiUrl(origin, "/api/products", fallbackParams));
        }

        if (categoryId) {
          const categoryParams = new URLSearchParams(baseParams);
          categoryParams.set("categoryId", String(categoryId));
          urls.push(buildApiUrl(origin, "/api/products", categoryParams));
          if (lang === DEFAULT_LANGUAGE) {
            const fallbackCategoryParams = new URLSearchParams({
              page: String(DEFAULT_PAGE),
              pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
              sort,
              categoryId: String(categoryId),
            });
            urls.push(buildApiUrl(origin, "/api/products", fallbackCategoryParams));
          }
        }
      });
    }
  });

  return urls;
}

function buildWarmupUrls(origin: string): string[] {
  const urls = new Set<string>();

  SUPPORTED_LANGUAGES.forEach((lang) => {
    const homepageParams = new URLSearchParams({
      latestLimit: String(HOMEPAGE_DEFAULT_LIMIT),
      popularLimit: String(HOMEPAGE_DEFAULT_LIMIT),
      lang,
    });
    urls.add(buildApiUrl(origin, "/api/homepage", homepageParams));
    HOMEPAGE_TIME_WINDOWS.forEach((timeWindow) => {
      const params = new URLSearchParams(homepageParams);
      params.set("timeWindow", timeWindow);
      urls.add(buildApiUrl(origin, "/api/homepage", params));
    });

    urls.add(buildApiUrl(origin, "/api/categories", new URLSearchParams({ lang })));

    POPULAR_LIMITS.forEach((limit) => {
      urls.add(
        buildApiUrl(
          origin,
          "/api/reviews/popular",
          new URLSearchParams({ limit: String(limit), lang })
        )
      );
    });

    LATEST_LIMITS.forEach((limit) => {
      urls.add(
        buildApiUrl(
          origin,
          "/api/reviews/latest",
          new URLSearchParams({ limit: String(limit), lang })
        )
      );
    });

    WARMUP_REVIEW_SORTS.forEach((sort) => {
      urls.add(
        buildApiUrl(
          origin,
          "/api/reviews",
          new URLSearchParams({
            page: String(DEFAULT_PAGE),
            pageSize: String(HOMEPAGE_DEFAULT_LIMIT),
            sort,
            lang,
            photoOnly: "true",
          })
        )
      );
    });
  });

  return Array.from(urls);
}

function buildCategoryCacheUrls(origin: string, parentId?: number | null): string[] {
  const urls: string[] = [];
  SUPPORTED_LANGUAGES.forEach((lang) => {
    urls.push(buildApiUrl(origin, "/api/categories", new URLSearchParams({ lang })));
    if (lang === DEFAULT_LANGUAGE) {
      urls.push(buildApiUrl(origin, "/api/categories"));
    }
    if (parentId) {
      urls.push(
        buildApiUrl(origin, `/api/categories/${parentId}/subcategories`, new URLSearchParams({ lang }))
      );
      if (lang === DEFAULT_LANGUAGE) {
        urls.push(buildApiUrl(origin, `/api/categories/${parentId}/subcategories`));
      }
    }
  });
  return urls;
}

function buildProductCacheUrls(options: {
  origin: string;
  productId?: string | null;
  productSlug?: string | null;
  productTranslations?: { lang: string; slug: string }[];
  categoryIds?: number[] | null;
}): string[] {
  const {
    origin,
    productId,
    productSlug,
    productTranslations,
    categoryIds,
  } = options;
  const urls: string[] = [];
  const translationEntries =
    productTranslations && productTranslations.length > 0
      ? productTranslations
      : productSlug
        ? [{ lang: DEFAULT_LANGUAGE, slug: productSlug }]
        : [];

  translationEntries.forEach((entry) => {
    const params = new URLSearchParams({ lang: entry.lang });
    urls.push(buildApiUrl(origin, `/api/products/slug/${entry.slug}`, params));
    if (entry.lang === DEFAULT_LANGUAGE) {
      urls.push(buildApiUrl(origin, `/api/products/slug/${entry.slug}`));
    }
  });

  SUPPORTED_LANGUAGES.forEach((lang) => {
    PRODUCT_SORTS.forEach((sort) => {
      const baseParams = new URLSearchParams({
        page: String(DEFAULT_PAGE),
        pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
        sort,
        lang,
      });
      urls.push(buildApiUrl(origin, "/api/products", baseParams));
      if (lang === DEFAULT_LANGUAGE) {
        const fallbackParams = new URLSearchParams({
          page: String(DEFAULT_PAGE),
          pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
          sort,
        });
        urls.push(buildApiUrl(origin, "/api/products", fallbackParams));
      }

      if (categoryIds && categoryIds.length > 0) {
        categoryIds.forEach((categoryId) => {
          const categoryParams = new URLSearchParams(baseParams);
          categoryParams.set("categoryId", String(categoryId));
          urls.push(buildApiUrl(origin, "/api/products", categoryParams));
          if (lang === DEFAULT_LANGUAGE) {
            const fallbackCategoryParams = new URLSearchParams({
              page: String(DEFAULT_PAGE),
              pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
              sort,
              categoryId: String(categoryId),
            });
            urls.push(buildApiUrl(origin, "/api/products", fallbackCategoryParams));
          }
        });
      }
    });

    if (productId) {
      PRODUCT_SORTS.forEach((sort) => {
        const reviewParams = new URLSearchParams({
          page: String(DEFAULT_PAGE),
          pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
          sort,
          lang,
        });
        urls.push(buildApiUrl(origin, `/api/products/${productId}/reviews`, reviewParams));
        if (lang === DEFAULT_LANGUAGE) {
          const fallbackReviewParams = new URLSearchParams({
            page: String(DEFAULT_PAGE),
            pageSize: String(DEFAULT_PAGE_SIZE_CACHE),
            sort,
          });
          urls.push(
            buildApiUrl(origin, `/api/products/${productId}/reviews`, fallbackReviewParams)
          );
        }
      });
    }
  });

  return urls;
}

function queueCachePurge(ctx: ExecutionContext, urls: string[]) {
  if (urls.length === 0) {
    return;
  }
  ctx.waitUntil(purgeCacheUrls(urls));
}

async function warmupCache(env: ParsedEnv): Promise<void> {
  const origin = env.CACHE_WARMUP_ORIGIN?.replace(/\/$/, "");
  if (!origin) {
    console.warn("Cache warmup skipped: CACHE_WARMUP_ORIGIN is not set");
    return;
  }

  const urls = buildWarmupUrls(origin);
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url);
      response.body?.cancel();
      return response.status;
    })
  );
  const failures = results.filter((result) => result.status === "rejected").length;
  if (failures > 0) {
    console.warn("Cache warmup completed with failures", {
      total: results.length,
      failures,
    });
  } else {
    console.info("Cache warmup completed", { total: results.length });
  }
}

async function handleHealth(): Promise<Response> {
  return jsonResponse({ ok: true, timestamp: new Date().toISOString() }, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleCategories({ env, url }: HandlerContext): Promise<Response> {
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const categories = await fetchCategories(env, lang);
  return jsonResponse({
    items: categories,
    pageInfo: buildPaginationInfo(1, categories.length, categories.length),
  });
}

async function handleSubcategories({
  env,
  params,
  url,
}: HandlerContext): Promise<Response> {
  const { id } = z
    .object({ id: z.coerce.number().int().positive() })
    .parse(params);
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const categories = await fetchSubcategories(env, id, lang);
  return jsonResponse({
    items: categories,
    pageInfo: buildPaginationInfo(1, categories.length, categories.length),
  });
}

async function handlePopularReviews({ env, url }: HandlerContext): Promise<Response> {
  const { limit, lang, timeWindow } = popularQuerySchema.parse(getQueryObject(url));
  const reviews = await fetchPopularReviews(env, limit, lang, timeWindow);
  return jsonResponse({
    items: reviews,
    pageInfo: buildPaginationInfo(1, reviews.length, reviews.length),
  });
}

async function handleLatestReviews({ env, url }: HandlerContext): Promise<Response> {
  const { cursor, limit, lang } = latestQuerySchema.parse(getQueryObject(url));
  const result = await fetchLatestReviews(env, cursor ?? null, limit, lang);
  return jsonResponse(result);
}

async function handleLatestComments({ env, url }: HandlerContext): Promise<Response> {
  const { limit, lang } = z.object({ limit: limitSchema, lang: langSchema }).parse(getQueryObject(url));
  const comments = await fetchLatestComments(env, limit, lang);
  return jsonResponse({ items: comments });
}

async function handleHomepage({ env, url }: HandlerContext): Promise<Response> {
  const { latestLimit, popularLimit, lang, timeWindow } =
    homepageQuerySchema.parse(getQueryObject(url));
  const popularTimeWindow = timeWindow ?? "week";
  const [latestResult, popularResult, categoriesResult] = await Promise.allSettled([
    fetchHomepageLatestReviews(env, latestLimit, lang),
    fetchHomepagePopularReviews(env, popularLimit, lang, popularTimeWindow),
    fetchCategories(env, lang),
  ]);
  const latest =
    latestResult.status === "fulfilled"
      ? latestResult.value
      : { items: [], nextCursor: null };
  if (latestResult.status === "rejected") {
    console.warn("Homepage latest fetch failed", latestResult.reason);
  }
  let popular =
    popularResult.status === "fulfilled" ? popularResult.value : [];
  if (popularResult.status === "rejected") {
    console.warn("Homepage popular fetch failed", popularResult.reason);
    if (latest.items.length > 0) {
      popular = latest.items.slice(0, popularLimit);
    }
  }
  const categories =
    categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  if (categoriesResult.status === "rejected") {
    console.warn("Homepage categories fetch failed", categoriesResult.reason);
  }
  const topUsernames = Array.from(
    new Set(popular.map((review) => review.author.username).filter(Boolean))
  ).slice(0, 3);
  const topReviewerRecords = await Promise.all(
    topUsernames.map(async (username) => {
      try {
        const record = await fetchUserProfileRecord(env, username);
        return record?.profile ?? null;
      } catch (error) {
        console.warn("Homepage top reviewer fetch failed", error);
        return null;
      }
    })
  );
  const resolvedTopReviewers = topReviewerRecords.filter(
    (profile): profile is UserProfile => Boolean(profile)
  );
  const fallbackTopReviewers =
    resolvedTopReviewers.length === 0 && topUsernames.length > 0
      ? topUsernames.map((username) => {
        const match = popular.find(
          (review) => review.author.username === username
        );
        return {
          username,
          displayName: match?.author.displayName,
          profilePicUrl: match?.author.profilePicUrl,
        };
      })
      : [];
  const payload: HomepagePayload = {
    latest,
    popular: { items: popular },
    categories: { items: categories },
    topReviewers: {
      items:
        resolvedTopReviewers.length > 0
          ? resolvedTopReviewers
          : fallbackTopReviewers,
    },
  };
  return jsonResponse({ items: payload });
}

async function handleReviewsList({ env, url }: HandlerContext): Promise<Response> {
  const { categoryId, subCategoryId, sort, page, pageSize, lang, photoOnly } =
    listQuerySchema.parse(getQueryObject(url));
  const result = await fetchReviews(env, {
    categoryId,
    subCategoryId,
    photoOnly,
    sort: sort ?? "latest",
    page,
    pageSize,
    lang,
  });
  return jsonResponse(result);
}

async function handleProductsList({ env, url }: HandlerContext): Promise<Response> {
  const { categoryId, sort, page, pageSize, lang } = productListQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchProducts(env, {
    categoryId,
    sort: sort ?? "latest",
    page,
    pageSize,
    lang,
  });
  return jsonResponse(result);
}

async function handleProductBySlug({ env, params, url }: HandlerContext): Promise<Response> {
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const { slug } = slugParamSchema.parse(params);
  const product = await fetchProductBySlug(env, slug, lang);
  if (!product) {
    return errorResponse(404, "Product not found");
  }
  return jsonResponse(product);
}

async function handleProductReviews({ env, params, url }: HandlerContext): Promise<Response> {
  const { id } = productIdParamSchema.parse(params);
  const { sort, page, pageSize, lang } = productReviewQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchReviews(env, {
    productId: id,
    sort: sort ?? "latest",
    page,
    pageSize,
    lang,
  });
  return jsonResponse(result);
}

async function handleProductSearch({ env, url }: HandlerContext): Promise<Response> {
  const { q, limit, includePending, lang } = productSearchQuerySchema.parse(
    getQueryObject(url)
  );
  const items = await searchProducts(env, { q, limit, lang, includePending });
  return jsonResponse({
    items,
    pageInfo: buildPaginationInfo(1, items.length, items.length),
  });
}

async function handleReviewBySlug({ env, params, url }: HandlerContext): Promise<Response> {
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const { slug } = slugParamSchema.parse(params);
  const review = await fetchReviewBySlug(env, slug, lang);
  if (!review) {
    return errorResponse(404, "Review not found");
  }
  return jsonResponse(review);
}

async function handleReviewComments({ env, params, url }: HandlerContext): Promise<Response> {
  const { id } = reviewIdParamSchema.parse(params);
  const meta = await fetchReviewMetaById(env, id);
  if (!meta || meta.status !== "published") {
    return errorResponse(404, "Review not found");
  }
  const { cursor, limit } = commentQuerySchema.parse(getQueryObject(url));
  const result = await fetchReviewComments(env, id, cursor ?? null, limit);
  return jsonResponse(result);
}

async function handleReviewView({ env, params, request }: HandlerContext): Promise<Response> {
  const { id } = reviewIdParamSchema.parse(params);
  enforceRateLimit(request, env);
  const meta = await fetchReviewMetaById(env, id);
  if (!meta || meta.status !== "published") {
    return errorResponse(404, "Review not found");
  }
  const user = await getAuthUser(request, env);
  const ip = getClientIp(request);
  const ipHash = ip && ip !== "unknown" ? await hashString(ip) : null;
  const result = await incrementReviewViews(env, {
    reviewId: id,
    reviewAuthorId: meta.authorId ?? null,
    viewerUserId: user?.id ?? null,
    ipHash,
  });
  if (!result) {
    return errorResponse(404, "Review not found");
  }
  return jsonResponse(
    { id, views: result.views },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handleCreateReview({ env, request }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const payload = createReviewSchema.parse(await readJson(request));
  const result = await createReview(env, {
    title: payload.title,
    excerpt: payload.excerpt,
    contentHtml: payload.contentHtml,
    rating: payload.rating,
    recommend: payload.recommend ?? undefined,
    pros: payload.pros,
    cons: payload.cons,
    categoryId: payload.categoryId,
    subCategoryId: payload.subCategoryId ?? null,
    productId: payload.productId ?? null,
    productName: payload.productName ?? null,
    photoUrls: payload.photoUrls ?? [],
    productPhotoUrl: payload.productPhotoUrl ?? null,
    userId: user.id,
    lang: payload.lang,
  });
  return jsonResponse(result, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function handleCreateComment({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { id } = reviewIdParamSchema.parse(params);
  const meta = await fetchReviewMetaById(env, id);
  if (!meta || meta.status !== "published") {
    return errorResponse(404, "Review not found");
  }
  const { text } = createCommentSchema.parse(await readJson(request));
  const comment = await addComment(env, { reviewId: id, userId: user.id, text });
  queueCachePurge(
    ctx,
    buildReviewCacheUrls({
      origin: url.origin,
      slug: meta.slug,
      reviewId: id,
      categoryId: meta.categoryId,
      productId: meta.productId ?? null,
      productSlug: meta.productSlug ?? null,
      productTranslations: meta.productTranslations,
      authorUsername: meta.authorUsername ?? null,
      translations: meta.translations,
    })
  );
  return jsonResponse(comment, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function handleVote({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { id } = reviewIdParamSchema.parse(params);
  const meta = await fetchReviewMetaById(env, id);
  if (!meta || meta.status !== "published") {
    return errorResponse(404, "Review not found");
  }
  const { type } = voteSchema.parse(await readJson(request));
  try {
    const result = await addVote(env, {
      reviewId: id,
      userId: user.id,
      type,
    });
    queueCachePurge(
      ctx,
      buildReviewCacheUrls({
        origin: url.origin,
        slug: meta.slug,
        reviewId: id,
        categoryId: meta.categoryId,
        productId: meta.productId ?? null,
        productSlug: meta.productSlug ?? null,
        productTranslations: meta.productTranslations,
        authorUsername: meta.authorUsername ?? null,
        translations: meta.translations,
      })
    );
    return jsonResponse(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(error.code) === "23505"
    ) {
      return errorResponse(409, "Already voted");
    }
    throw error;
  }
}

async function handleReportReview({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { id } = reviewIdParamSchema.parse(params);
  const { reason, details } = reportBodySchema.parse(await readJson(request));
  const meta = await fetchReviewMetaById(env, id);
  if (!meta || meta.status !== "published") {
    return errorResponse(404, "Review not found");
  }
  const report = await createReport(env, {
    reporterUserId: user.id,
    targetType: "review",
    targetId: id,
    reason,
    details,
  });
  return jsonResponse(report, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function handleReportComment({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { id } = commentIdParamSchema.parse(params);
  const { reason, details } = reportBodySchema.parse(await readJson(request));
  const comment = await fetchCommentStatusById(env, id);
  if (!comment || comment.status !== "published") {
    return errorResponse(404, "Comment not found");
  }
  const report = await createReport(env, {
    reporterUserId: user.id,
    targetType: "comment",
    targetId: id,
    reason,
    details,
  });
  return jsonResponse(report, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function handleReportUser({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { userId } = userIdParamSchema.parse(params);
  const { reason, details } = reportBodySchema.parse(await readJson(request));
  const profile = await fetchProfileByUserId(env, userId);
  if (!profile) {
    return errorResponse(404, "User not found");
  }
  const report = await createReport(env, {
    reporterUserId: user.id,
    targetType: "user",
    targetId: userId,
    reason,
    details,
  });
  return jsonResponse(report, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function handleMyFollowing({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  const { page, pageSize, usernames } = followListQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchFollowingUsers(env, user.id, {
    page,
    pageSize,
    usernames,
  });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleFollowUser({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }
  if (record.userId === user.id) {
    return errorResponse(400, "Cannot follow yourself");
  }
  await followUser(env, user.id, record.userId);
  return jsonResponse({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

async function handleUnfollowUser({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }
  if (record.userId === user.id) {
    return errorResponse(400, "Cannot unfollow yourself");
  }
  await unfollowUser(env, user.id, record.userId);
  return jsonResponse({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

async function handleMyBlocks({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  const { page, pageSize, usernames } = blockListQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchBlockedUsers(env, user.id, {
    page,
    pageSize,
    usernames,
  });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleBlockUser({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }
  if (record.userId === user.id) {
    return errorResponse(400, "Cannot block yourself");
  }
  await blockUserRelation(env, user.id, record.userId);
  return jsonResponse({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

async function handleUnblockUser({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }
  if (record.userId === user.id) {
    return errorResponse(400, "Cannot unblock yourself");
  }
  await unblockUserRelation(env, user.id, record.userId);
  return jsonResponse({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

async function handleSendMessage({ env, request }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { username, subject, body } = messageCreateSchema.parse(
    await readJson(request)
  );
  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }
  if (record.userId === user.id) {
    return errorResponse(400, "Cannot message yourself");
  }
  const blocked = await isBlockedBetween(env, user.id, record.userId);
  if (blocked) {
    return errorResponse(403, "Messaging is blocked");
  }
  const conversation = await getOrCreateConversation(env, user.id, record.userId);
  const message = await createDirectMessage(env, {
    conversationId: conversation.id,
    senderUserId: user.id,
    recipientUserId: record.userId,
    subject,
    body,
  });
  return jsonResponse(message, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function handleMessageThreads({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  const { page, pageSize } = messageThreadQuerySchema.parse(getQueryObject(url));
  const result = await fetchMessageThreads(env, user.id, { page, pageSize });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleMessageThread({ env, request, params, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  const { id } = conversationIdParamSchema.parse(params);
  const { page, pageSize } = messageThreadQuerySchema.parse(getQueryObject(url));
  const conversation = await fetchConversationById(env, id);
  if (!conversation) {
    return errorResponse(404, "Conversation not found");
  }
  if (conversation.userAId !== user.id && conversation.userBId !== user.id) {
    return errorResponse(403, "Not authorized");
  }
  const result = await fetchThreadMessages(env, id, { page, pageSize });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleUserProfile({ env, params }: HandlerContext): Promise<Response> {
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }
  return jsonResponse(record.profile);
}

async function handleUserReviews({ env, params, url }: HandlerContext): Promise<Response> {
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const { page, pageSize, lang } = userListQuerySchema.parse(getQueryObject(url));

  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }
  const result = await fetchReviewsByUserId(
    env,
    record.userId,
    page,
    pageSize,
    lang,
    ["published"]
  );
  return jsonResponse(result);
}

async function handleUserComments({ env, params, url }: HandlerContext): Promise<Response> {
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const { page, pageSize, lang } = userListQuerySchema.parse(getQueryObject(url));

  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }

  const result = await fetchReviewsByUserComments(
    env,
    record.userId,
    page,
    pageSize,
    lang
  );
  return jsonResponse(result);
}

async function handleUserDrafts({
  env,
  params,
  request,
  url,
}: HandlerContext): Promise<Response> {
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const { page, pageSize, lang } = userListQuerySchema.parse(getQueryObject(url));

  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }

  const user = await requireAuth(request, env);
  if (user.id !== record.userId) {
    return errorResponse(403, "Forbidden");
  }

  const result = await fetchReviewsByUserId(
    env,
    record.userId,
    page,
    pageSize,
    lang,
    ["draft"]
  );
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleUserSaved({
  env,
  params,
  request,
  url,
}: HandlerContext): Promise<Response> {
  const { username } = z.object({ username: z.string().min(1) }).parse(params);
  const { page, pageSize, lang } = userListQuerySchema.parse(getQueryObject(url));

  const record = await fetchUserProfileRecord(env, username);
  if (!record) {
    return errorResponse(404, "User not found");
  }

  const user = await requireAuth(request, env);
  if (user.id !== record.userId) {
    return errorResponse(403, "Forbidden");
  }

  const result = await fetchSavedReviews(env, record.userId, page, pageSize, lang);
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleSearch({ env, url }: HandlerContext): Promise<Response> {
  const { q, categoryId, page, pageSize, lang } = searchQuerySchema.parse(
    getQueryObject(url)
  );
  const trimmed = q.trim();
  if (!trimmed) {
    return jsonResponse({
      items: [],
      pageInfo: buildPaginationInfo(page, pageSize, 0),
    });
  }
  const result = await searchReviews(env, {
    q: trimmed,
    categoryId,
    page,
    pageSize,
    lang,
  });
  return jsonResponse(result);
}

async function handleSearchSuggest({
  env,
  url,
}: HandlerContext): Promise<Response> {
  const { q, limit, lang } = searchSuggestQuerySchema.parse(getQueryObject(url));
  const trimmed = q.trim();
  if (!trimmed) {
    return jsonResponse({
      items: [],
      pageInfo: buildPaginationInfo(1, limit, 0),
    });
  }

  const [reviewItems, productItems] = await Promise.all([
    searchReviewSuggestions(env, { q: trimmed, limit, lang }),
    searchProductSuggestions(env, { q: trimmed, limit, lang }),
  ]);

  const sortedProducts = productItems.sort((a, b) => b.score - a.score);
  const sortedReviews = reviewItems.sort((a, b) => b.score - a.score);
  const merged = [...sortedProducts, ...sortedReviews]
    .slice(0, limit)
    .map(({ score, ...item }) => item);

  return jsonResponse({
    items: merged,
    pageInfo: buildPaginationInfo(1, limit, merged.length),
  });
}

async function handleLeaderboard({ env, url }: HandlerContext): Promise<Response> {
  const { metric, timeframe, page, pageSize } = leaderboardQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchLeaderboard(env, {
    metric,
    timeframe,
    page,
    pageSize,
  });
  return jsonResponse(result);
}

async function handleProfile({ env, request }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  const profile = await fetchProfileDetailsByUserId(env, user.id);
  if (!profile) {
    return errorResponse(404, "Profile not found");
  }
  return jsonResponse(profile, { headers: { "Cache-Control": "no-store" } });
}

async function handleProfileUpdate({
  env,
  request,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const payload = profileUpdateSchema.parse(await readJson(request));
  const normalizedUsername = payload.username?.toLowerCase();
  const normalizedBio = payload.bio === "" ? null : payload.bio;

  try {
    const updated = await updateProfileByUserId(env, user.id, {
      username: normalizedUsername,
      bio: normalizedBio,
      profilePicUrl: payload.profilePicUrl,
    });
    if (!updated) {
      return errorResponse(404, "Profile not found");
    }
    return jsonResponse(updated, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(error.code) === "23505"
    ) {
      return errorResponse(409, "Username is already taken");
    }
    throw error;
  }
}

async function handlePresign({ env, request }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  enforceRateLimit(request, env, user.id);
  const { filename, contentType } = presignSchema.parse(await readJson(request));
  const result = await createPresignedUploadUrl(env, user.id, filename, contentType);
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleInternalCachePurge({
  env,
  request,
  url,
}: HandlerContext): Promise<Response> {
  const secret = env.CACHE_PURGE_SECRET;
  if (!secret) {
    return errorResponse(403, "Cache purge is not configured");
  }
  const provided = request.headers.get("x-cache-purge-secret");
  if (!provided || provided !== secret) {
    return errorResponse(401, "Unauthorized");
  }

  const payload = cachePurgeSchema.parse(await readJson(request));
  const meta = await fetchReviewMetaById(env, payload.reviewId);
  if (!meta) {
    return jsonResponse(
      { ok: true, purged: 0, urls: 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const urls = buildReviewCacheUrls({
    origin: url.origin,
    slug: meta.slug,
    reviewId: payload.reviewId,
    categoryId: meta.categoryId ?? null,
    productId: meta.productId ?? null,
    productSlug: meta.productSlug ?? null,
    productTranslations: meta.productTranslations,
    authorUsername: meta.authorUsername ?? null,
    translations: meta.translations,
  });
  const purged = await purgeCacheUrls(urls);
  return jsonResponse(
    { ok: true, purged, urls: urls.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handleSitemapReviewsJson({ env, url }: HandlerContext): Promise<Response> {
  const { part, pageSize, lang, countOnly } = sitemapReviewsQuerySchema.parse(getQueryObject(url));
  if (countOnly) {
    const totalItems = await fetchSitemapReviewCount(env, lang);
    return jsonResponse({
      items: [],
      pageInfo: buildPaginationInfo(part, pageSize, totalItems),
    });
  }
  const result = await fetchSitemapReviews(env, part, pageSize, lang);
  return jsonResponse(result);
}

async function handleSitemapProductsJson({ env, url }: HandlerContext): Promise<Response> {
  const { part, pageSize, lang, countOnly } = sitemapReviewsQuerySchema.parse(getQueryObject(url));
  if (countOnly) {
    const totalItems = await fetchSitemapProductCount(env, lang);
    return jsonResponse({
      items: [],
      pageInfo: buildPaginationInfo(part, pageSize, totalItems),
    });
  }
  const result = await fetchSitemapProducts(env, part, pageSize, lang);
  return jsonResponse(result);
}

async function handleSitemapCategoriesJson({ env, url }: HandlerContext): Promise<Response> {
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const result = await fetchSitemapCategories(env, lang);
  return jsonResponse(result);
}

async function handleSitemapIndexXml({ env }: HandlerContext): Promise<Response> {
  // Always use the main website domain for sitemap URLs
  const origin = "https://userreview.net";

  const allUrls: string[] = [];

  // Generate sitemaps for all supported languages in parallel
  await Promise.all(
    SUPPORTED_LANGUAGES.map(async (lang) => {
      const reviewCount = await fetchSitemapReviewCount(env, lang);
      const productCount = await fetchSitemapProductCount(env, lang);

      const pageSize = 5000;
      const totalPages = Math.ceil(reviewCount / pageSize) || 1;
      const productPages = Math.ceil(productCount / pageSize) || 1;

      const langUrls: string[] = [];

      // Categories - web-friendly URL
      langUrls.push(`${origin}/sitemap-categories-${lang}.xml`);

      // Products - web-friendly URLs
      for (let part = 1; part <= productPages; part += 1) {
        langUrls.push(`${origin}/sitemap-products-${lang}-${part}.xml`);
      }

      // Reviews - web-friendly URLs
      for (let part = 1; part <= totalPages; part += 1) {
        langUrls.push(`${origin}/sitemap-${lang}-${part}.xml`);
      }

      allUrls.push(...langUrls);
    })
  );

  // Sort for consistent output
  allUrls.sort();

  return xmlResponse(buildSitemapIndex(allUrls));
}

async function handleSitemapCategoriesXml({ env, request }: HandlerContext): Promise<Response> {
  const origin = new URL(request.url).origin;
  const { lang } = z.object({ lang: langSchema }).parse(
    getQueryObject(new URL(request.url))
  );
  const categories = await fetchSitemapCategories(env, lang);
  const urls = [
    { loc: `${origin}/${lang}`, changefreq: "daily" as const, priority: 1.0 },
    { loc: `${origin}/${lang}/catalog`, changefreq: "daily" as const, priority: 0.9 },
    { loc: `${origin}/${lang}/contact`, changefreq: "monthly" as const, priority: 0.5 },
    { loc: `${origin}/${lang}/privacy-policy`, changefreq: "yearly" as const, priority: 0.3 },
    { loc: `${origin}/${lang}/terms-of-use`, changefreq: "yearly" as const, priority: 0.3 },
  ];
  for (const category of categories.items) {
    urls.push({ loc: `${origin}/${lang}/catalog/reviews/${category.id}`, changefreq: "weekly" as const, priority: 0.8 });
  }
  return xmlResponse(buildUrlset(urls));
}

async function handleSitemapReviewsXml({ env, request, url }: HandlerContext): Promise<Response> {
  const origin = new URL(request.url).origin;
  const { part, pageSize, lang } = sitemapReviewsQuerySchema.parse(getQueryObject(url));
  const result = await fetchSitemapReviews(env, part, pageSize, lang);
  const urls = result.items.map((item) => ({
    loc: `${origin}/${lang}/content/${item.slug}`,
    lastmod: item.updatedAt ?? item.createdAt,
    changefreq: "weekly" as const,
    priority: 0.7,
    images: item.imageUrls,
  }));
  return xmlResponse(buildUrlset(urls));
}

async function handleSitemapProductsXml({ env, request, url }: HandlerContext): Promise<Response> {
  const origin = new URL(request.url).origin;
  const { part, pageSize, lang } = sitemapReviewsQuerySchema.parse(getQueryObject(url));
  const result = await fetchSitemapProducts(env, part, pageSize, lang);
  const urls = result.items.map((item) => ({
    loc: `${origin}/${lang}/products/${item.slug}`,
    lastmod: item.updatedAt ?? item.createdAt,
    changefreq: "weekly" as const,
    priority: 0.8,
    images: item.imageUrls,
  }));
  return xmlResponse(buildUrlset(urls));
}

// Web-friendly URL handlers (parse lang/part from URL path instead of query params)
async function handleWebSitemapReviews({ env, request, params }: HandlerContext): Promise<Response> {
  const query = getQueryObject(new URL(request.url));
  const origin = query.origin || "https://userreview.net";

  // Parse lang and part from URL: /api/sitemap-en-1.xml
  const rawLang = params.lang;
  const rawPart = params.part;

  const lang = isSupportedLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;
  const part = parseInt(rawPart ?? "1", 10) || 1;
  const pageSize = 5000;

  const result = await fetchSitemapReviews(env, part, pageSize, lang);
  const urls = result.items.map((item) => ({
    loc: `${origin}/${lang}/content/${item.slug}`,
    lastmod: item.updatedAt ?? item.createdAt,
    changefreq: "weekly" as const,
    priority: 0.7,
    images: item.imageUrls,
  }));
  return xmlResponse(buildUrlset(urls));
}

async function handleWebSitemapProducts({ env, request, params }: HandlerContext): Promise<Response> {
  const query = getQueryObject(new URL(request.url));
  const origin = query.origin || "https://userreview.net";

  // Parse lang and part from URL: /api/sitemap-products-en-1.xml
  const rawLang = params.lang;
  const rawPart = params.part;

  const lang = isSupportedLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;
  const part = parseInt(rawPart ?? "1", 10) || 1;
  const pageSize = 5000;

  const result = await fetchSitemapProducts(env, part, pageSize, lang);
  const urls = result.items.map((item) => ({
    loc: `${origin}/${lang}/products/${item.slug}`,
    lastmod: item.updatedAt ?? item.createdAt,
    changefreq: "weekly" as const,
    priority: 0.8,
    images: item.imageUrls,
  }));
  return xmlResponse(buildUrlset(urls));
}

async function handleWebSitemapCategories({ env, request, params }: HandlerContext): Promise<Response> {
  const query = getQueryObject(new URL(request.url));
  const origin = query.origin || "https://userreview.net";

  const rawLang = params.lang || query.lang;
  const lang = isSupportedLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  const categories = await fetchSitemapCategories(env, lang);
  const urls = [
    { loc: `${origin}/${lang}`, changefreq: "daily" as const, priority: 1.0 },
    { loc: `${origin}/${lang}/catalog`, changefreq: "daily" as const, priority: 0.9 },
    { loc: `${origin}/${lang}/leaderboard`, changefreq: "daily" as const, priority: 0.7 },
    { loc: `${origin}/${lang}/contact`, changefreq: "monthly" as const, priority: 0.5 },
    { loc: `${origin}/${lang}/privacy-policy`, changefreq: "yearly" as const, priority: 0.3 },
    { loc: `${origin}/${lang}/terms-of-use`, changefreq: "yearly" as const, priority: 0.3 },
    { loc: `${origin}/${lang}/about-us`, changefreq: "monthly" as const, priority: 0.5 },
  ];
  for (const category of categories.items) {
    urls.push({
      loc: `${origin}/${lang}/catalog/reviews/${category.id}`,
      changefreq: "weekly" as const,
      priority: 0.8,
    });
  }
  return xmlResponse(buildUrlset(urls));
}

async function handleAdminCategories({ env, request }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const categories = await fetchCategories(env, DEFAULT_LANGUAGE);
  return jsonResponse(
    {
      items: categories,
      pageInfo: buildPaginationInfo(1, categories.length, categories.length),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handleAdminCategoryCreate({
  env,
  request,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const payload = adminCategoryCreateSchema.parse(await readJson(request));
  const category = await createCategory(env, {
    name: payload.name,
    parentId: payload.parentId ?? null,
  });
  queueCachePurge(
    ctx,
    buildCategoryCacheUrls(url.origin, payload.parentId ?? null)
  );
  return jsonResponse(category, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function handleAdminCategoryUpdate({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { id } = z
    .object({ id: z.coerce.number().int().positive() })
    .parse(params);
  const payload = adminCategoryUpdateSchema.parse(await readJson(request));
  if (payload.parentId !== undefined && payload.parentId === id) {
    return errorResponse(400, "Category cannot be its own parent");
  }
  const category = await updateCategory(env, id, {
    name: payload.name,
    parentId: payload.parentId,
  });
  if (!category) {
    return errorResponse(404, "Category not found");
  }
  queueCachePurge(
    ctx,
    buildCategoryCacheUrls(
      url.origin,
      payload.parentId ?? category.parentId ?? null
    )
  );
  return jsonResponse(category, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminCategoryTranslations({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { id } = z
    .object({ id: z.coerce.number().int().positive() })
    .parse(params);

  if (request.method === "GET") {
    const items = await fetchCategoryTranslations(env, id);
    return jsonResponse(
      { items, pageInfo: buildPaginationInfo(1, items.length, items.length) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  enforceRateLimit(request, env, user.id);
  const payload = categoryTranslationsSchema.parse(await readJson(request));
  const items = await upsertCategoryTranslations(env, id, payload.translations);
  const categories = await fetchCategories(env, DEFAULT_LANGUAGE);
  const parentId = categories.find((category) => category.id === id)?.parentId ?? null;
  queueCachePurge(ctx, buildCategoryCacheUrls(url.origin, parentId));
  return jsonResponse(
    { items, pageInfo: buildPaginationInfo(1, items.length, items.length) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handleAdminUploadHealth({
  env,
  request,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const health = buildUploadHealth(env);
  return jsonResponse(health);
}

async function handleAdminProducts({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { q, status, page, pageSize, lang } = adminProductQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchAdminProducts(env, { q, status, page, pageSize, lang });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminProductDetail({
  env,
  request,
  params,
  url,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { id } = productIdParamSchema.parse(params);
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const product = await fetchAdminProductDetail(env, id, lang);
  if (!product) {
    return errorResponse(404, "Product not found");
  }
  return jsonResponse(product, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminProductCreate({
  env,
  request,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const payload = adminProductCreateSchema.parse(await readJson(request));
  const product = await createAdminProduct(
    env,
    {
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status,
      brandId: payload.brandId ?? null,
      categoryIds: payload.categoryIds,
      imageUrls: payload.imageUrls,
    },
    lang
  );
  queueCachePurge(
    ctx,
    buildProductCacheUrls({
      origin: url.origin,
      productId: product.id,
      productSlug: product.slug,
      productTranslations: product.translations,
      categoryIds: product.categoryIds,
    })
  );
  return jsonResponse(product, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function handleAdminProductUpdate({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { id } = productIdParamSchema.parse(params);
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const payload = adminProductUpdateSchema.parse(await readJson(request));
  const product = await updateAdminProduct(
    env,
    id,
    {
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status,
      brandId: payload.brandId ?? null,
      categoryIds: payload.categoryIds,
      imageUrls: payload.imageUrls,
    },
    lang
  );
  if (!product) {
    return errorResponse(404, "Product not found");
  }
  queueCachePurge(
    ctx,
    buildProductCacheUrls({
      origin: url.origin,
      productId: product.id,
      productSlug: product.slug,
      productTranslations: product.translations,
      categoryIds: product.categoryIds,
    })
  );
  return jsonResponse(product, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminProductTranslations({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { id } = productIdParamSchema.parse(params);

  if (request.method === "GET") {
    const items = await fetchProductTranslations(env, id);
    return jsonResponse(
      { items, pageInfo: buildPaginationInfo(1, items.length, items.length) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  enforceRateLimit(request, env, user.id);
  const payload = productTranslationsSchema.parse(await readJson(request));
  const items = await upsertProductTranslations(env, id, payload.translations);
  const product = await fetchAdminProductDetail(env, id, DEFAULT_LANGUAGE);
  if (!product) {
    return errorResponse(404, "Product not found");
  }
  queueCachePurge(
    ctx,
    buildProductCacheUrls({
      origin: url.origin,
      productId: product.id,
      productSlug: product.slug,
      productTranslations: product.translations,
      categoryIds: product.categoryIds,
    })
  );
  return jsonResponse(
    { items, pageInfo: buildPaginationInfo(1, items.length, items.length) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function handleAdminReviews({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { q, status, page, pageSize, lang } = adminReviewQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchAdminReviews(env, { q, status, page, pageSize, lang });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminReviewDetail({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { id } = reviewIdParamSchema.parse(params);
  const { lang } = z.object({ lang: langSchema }).parse(
    getQueryObject(new URL(request.url))
  );
  const review = await fetchAdminReviewDetail(env, id, lang);
  if (!review) {
    return errorResponse(404, "Review not found");
  }
  return jsonResponse(review, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminComments({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { q, status, reviewId, page, pageSize } = adminCommentQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchAdminComments(env, {
    q,
    status,
    reviewId,
    page,
    pageSize,
  });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminUsers({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { q, page, pageSize } = adminUserQuerySchema.parse(getQueryObject(url));
  const result = await fetchAdminUsers(env, { q, page, pageSize });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminUserDetail({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { userId } = userIdParamSchema.parse(params);
  const detail = await fetchAdminUserDetail(env, userId);
  if (!detail) {
    return errorResponse(404, "User not found");
  }
  return jsonResponse(detail, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminReports({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { q, status, targetType, page, pageSize } = reportQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchReports(env, { q, status, targetType, page, pageSize });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminReportPatch({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { id } = z.object({ id: z.string().uuid() }).parse(params);
  const { status } = reportStatusSchema.parse(await readJson(request));
  const report = await updateReportStatus(env, id, status);
  if (!report) {
    return errorResponse(404, "Report not found");
  }
  return jsonResponse(report, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminReviewStatus({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { id } = reviewIdParamSchema.parse(params);
  const meta = await fetchReviewMetaById(env, id);
  const { status } = reviewStatusSchema.parse(await readJson(request));
  const review = await updateReviewStatus(env, id, status);
  if (!review) {
    return errorResponse(404, "Review not found");
  }
  if (meta) {
    queueCachePurge(
      ctx,
      buildReviewCacheUrls({
        origin: url.origin,
        slug: review.slug,
        reviewId: review.id,
        categoryId: meta.categoryId,
        productId: meta.productId ?? null,
        productSlug: meta.productSlug ?? null,
        productTranslations: meta.productTranslations,
        authorUsername: meta.authorUsername ?? null,
        translations: meta.translations,
      })
    );
  }
  return jsonResponse({ id: review.id, status: review.status }, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminReviewUpdate({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { id } = reviewIdParamSchema.parse(params);
  const previousMeta = await fetchReviewMetaById(env, id);
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const payload = adminReviewUpdateSchema.parse(await readJson(request));
  const updated = await updateAdminReview(
    env,
    id,
    {
      title: payload.title,
      excerpt: payload.excerpt,
      contentHtml: payload.contentHtml,
      photoUrls: payload.photoUrls,
      recommend: payload.recommend,
      pros: payload.pros,
      cons: payload.cons,
      categoryId: payload.categoryId,
      subCategoryId: payload.subCategoryId ?? null,
      productId: payload.productId ?? null,
    },
    lang
  );
  if (!updated) {
    return errorResponse(404, "Review not found");
  }
  const cacheUrls: string[] = [];
  if (previousMeta) {
    cacheUrls.push(
      ...buildReviewCacheUrls({
        origin: url.origin,
        slug: previousMeta.slug,
        reviewId: updated.id,
        categoryId: previousMeta.categoryId ?? null,
        productId: previousMeta.productId ?? null,
        productSlug: previousMeta.productSlug ?? null,
        productTranslations: previousMeta.productTranslations,
        authorUsername: previousMeta.authorUsername ?? null,
        translations: previousMeta.translations,
      })
    );
  }

  const nextMeta = await fetchReviewMetaById(env, updated.id);
  if (nextMeta) {
    cacheUrls.push(
      ...buildReviewCacheUrls({
        origin: url.origin,
        slug: nextMeta.slug,
        reviewId: updated.id,
        categoryId: nextMeta.categoryId ?? null,
        productId: nextMeta.productId ?? null,
        productSlug: nextMeta.productSlug ?? null,
        productTranslations: nextMeta.productTranslations,
        authorUsername: nextMeta.authorUsername ?? null,
        translations: nextMeta.translations,
      })
    );
  } else {
    cacheUrls.push(
      ...buildReviewCacheUrls({
        origin: url.origin,
        slug: updated.slug,
        reviewId: updated.id,
        categoryId: updated.categoryId ?? null,
        productId: updated.productId ?? null,
        productSlug: updated.product?.slug ?? null,
        authorUsername: updated.author.username,
      })
    );
  }

  queueCachePurge(ctx, cacheUrls);
  return jsonResponse(updated, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminCommentUpdate({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { id } = commentIdParamSchema.parse(params);
  const payload = adminCommentUpdateSchema.parse(await readJson(request));
  const updated = await updateAdminComment(env, id, payload);
  if (!updated) {
    return errorResponse(404, "Comment not found");
  }
  const meta = await fetchReviewMetaById(env, updated.reviewId);
  if (meta) {
    queueCachePurge(
      ctx,
      buildReviewCacheUrls({
        origin: url.origin,
        slug: meta.slug,
        reviewId: updated.reviewId,
        categoryId: meta.categoryId,
        productId: meta.productId ?? null,
        productSlug: meta.productSlug ?? null,
        productTranslations: meta.productTranslations,
        authorUsername: meta.authorUsername ?? null,
        translations: meta.translations,
      })
    );
  }
  return jsonResponse(updated, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminCommentStatus({
  env,
  request,
  params,
  url,
  ctx,
}: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { id } = commentIdParamSchema.parse(params);
  const { status } = commentStatusSchema.parse(await readJson(request));
  const comment = await updateCommentStatus(env, id, status);
  if (!comment) {
    return errorResponse(404, "Comment not found");
  }
  const meta = await fetchReviewMetaById(env, comment.reviewId);
  if (meta) {
    queueCachePurge(
      ctx,
      buildReviewCacheUrls({
        origin: url.origin,
        slug: meta.slug,
        reviewId: comment.reviewId,
        categoryId: meta.categoryId,
        productId: meta.productId ?? null,
        productSlug: meta.productSlug ?? null,
        productTranslations: meta.productTranslations,
        authorUsername: meta.authorUsername ?? null,
        translations: meta.translations,
      })
    );
  }
  return jsonResponse({ id: comment.id, status: comment.status }, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminUserUpdate({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { userId } = userIdParamSchema.parse(params);
  const payload = adminProfileUpdateSchema.parse(await readJson(request));
  const updatePayload: {
    username?: string;
    bio?: string | null;
    profilePicUrl?: string | null;
    isVerified?: boolean;
    verifiedBy?: string | null;
  } = {};
  if (payload.username !== undefined) {
    updatePayload.username = payload.username;
  }
  if (payload.bio !== undefined) {
    updatePayload.bio = payload.bio;
  }
  if (payload.profilePicUrl !== undefined) {
    updatePayload.profilePicUrl = payload.profilePicUrl;
  }
  if (payload.isVerified !== undefined) {
    updatePayload.isVerified = payload.isVerified;
    updatePayload.verifiedBy = payload.isVerified ? user.id : null;
  }
  const updated = await updateProfileByUserId(env, userId, updatePayload, {
    useAdminClient: true,
  });
  if (!updated) {
    return errorResponse(404, "User not found");
  }
  const detail = await fetchAdminUserDetail(env, userId);
  if (!detail) {
    return errorResponse(404, "User not found");
  }
  return jsonResponse(detail, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminUserRole({ env, request, params }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  enforceRateLimit(request, env, user.id);
  const { userId } = userIdParamSchema.parse(params);
  const { role } = userRoleSchema.parse(await readJson(request));
  const updated = await updateUserRole(env, userId, role);
  if (!updated) {
    return errorResponse(404, "User not found");
  }
  return jsonResponse(updated, { headers: { "Cache-Control": "no-store" } });
}

const routes: Route[] = [
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/health" }),
    handler: async () => handleHealth(),
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/categories" }),
    handler: handleCategories,
    cacheTtl: (env) => env.CACHE_TTL_CATEGORIES_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/categories/:id/subcategories" }),
    handler: handleSubcategories,
    cacheTtl: (env) => env.CACHE_TTL_SUBCATEGORIES_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/reviews/popular" }),
    handler: handlePopularReviews,
    cacheTtl: (env) => env.CACHE_TTL_POPULAR_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/reviews/latest" }),
    handler: handleLatestReviews,
    cacheTtl: (env) => env.CACHE_TTL_LATEST_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/comments/latest" }),
    handler: handleLatestComments,
    cacheTtl: (env) => env.CACHE_TTL_LATEST_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/homepage" }),
    handler: handleHomepage,
    cacheTtl: (env) => env.CACHE_TTL_HOMEPAGE_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/reviews/slug/:slug" }),
    handler: handleReviewBySlug,
    cacheTtl: (env) => env.CACHE_TTL_REVIEW_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/reviews/:id/comments" }),
    handler: handleReviewComments,
    cacheTtl: (env) => env.CACHE_TTL_REVIEW_COMMENTS_SEC,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/reviews/:id/view" }),
    handler: handleReviewView,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/reviews" }),
    handler: handleReviewsList,
    cacheTtl: (env) => env.CACHE_TTL_REVIEW_LIST_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/products" }),
    handler: handleProductsList,
    cacheTtl: (env) => env.CACHE_TTL_PRODUCTS_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/products/slug/:slug" }),
    handler: handleProductBySlug,
    cacheTtl: (env) => env.CACHE_TTL_PRODUCT_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/products/:id/reviews" }),
    handler: handleProductReviews,
    cacheTtl: (env) => env.CACHE_TTL_PRODUCT_REVIEWS_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/products/search" }),
    handler: handleProductSearch,
    cacheTtl: (env) => env.CACHE_TTL_SEARCH_SEC,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/reviews" }),
    handler: handleCreateReview,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/reviews/:id/comments" }),
    handler: handleCreateComment,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/reviews/:id/vote" }),
    handler: handleVote,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/reviews/:id/report" }),
    handler: handleReportReview,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/comments/:id/report" }),
    handler: handleReportComment,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/users/:userId/report" }),
    handler: handleReportUser,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/users/me/following" }),
    handler: handleMyFollowing,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/users/me/blocks" }),
    handler: handleMyBlocks,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/users/:username/follow" }),
    handler: handleFollowUser,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/users/:username/unfollow" }),
    handler: handleUnfollowUser,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/users/:username/block" }),
    handler: handleBlockUser,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/users/:username/unblock" }),
    handler: handleUnblockUser,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/messages/threads" }),
    handler: handleMessageThreads,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/messages/threads/:id" }),
    handler: handleMessageThread,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/messages" }),
    handler: handleSendMessage,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/users/:username/reviews" }),
    handler: handleUserReviews,
    cacheTtl: (env) => env.CACHE_TTL_USER_REVIEWS_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/users/:username/comments" }),
    handler: handleUserComments,
    cacheTtl: (env) => env.CACHE_TTL_USER_REVIEWS_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/users/:username/drafts" }),
    handler: handleUserDrafts,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/users/:username/saved" }),
    handler: handleUserSaved,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/users/:username" }),
    handler: handleUserProfile,
    cacheTtl: (env) => env.CACHE_TTL_USER_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/profile" }),
    handler: handleProfile,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/profile" }),
    handler: handleProfileUpdate,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/search/suggest" }),
    handler: handleSearchSuggest,
    cacheTtl: (env) => env.CACHE_TTL_SEARCH_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/search" }),
    handler: handleSearch,
    cacheTtl: (env) => env.CACHE_TTL_SEARCH_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/leaderboard" }),
    handler: handleLeaderboard,
    cacheTtl: (env) => env.CACHE_TTL_USER_SEC,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/uploads/presign" }),
    handler: handlePresign,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/internal/cache/purge" }),
    handler: handleInternalCachePurge,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap/reviews" }),
    handler: handleSitemapReviewsJson,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap/products" }),
    handler: handleSitemapProductsJson,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap/categories" }),
    handler: handleSitemapCategoriesJson,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap.xml" }),
    handler: handleSitemapIndexXml,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap-categories.xml" }),
    handler: handleSitemapCategoriesXml,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap-reviews" }),
    handler: handleSitemapReviewsXml,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap-products" }),
    handler: handleSitemapProductsXml,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  // Web-friendly sitemap URLs (parsed from path)
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap-:lang-:part.xml" }),
    handler: handleWebSitemapReviews,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap-products-:lang-:part.xml" }),
    handler: handleWebSitemapProducts,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/sitemap-categories-:lang.xml" }),
    handler: handleWebSitemapCategories,
    cacheTtl: (env) => env.CACHE_TTL_SITEMAP_SEC,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/categories" }),
    handler: handleAdminCategories,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/admin/categories" }),
    handler: handleAdminCategoryCreate,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/categories/:id" }),
    handler: handleAdminCategoryUpdate,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/categories/:id/translations" }),
    handler: handleAdminCategoryTranslations,
    noStore: true,
  },
  {
    method: "PUT",
    pattern: new URLPattern({ pathname: "/api/admin/categories/:id/translations" }),
    handler: handleAdminCategoryTranslations,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/uploads/health" }),
    handler: handleAdminUploadHealth,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/products" }),
    handler: handleAdminProducts,
    noStore: true,
  },
  {
    method: "POST",
    pattern: new URLPattern({ pathname: "/api/admin/products" }),
    handler: handleAdminProductCreate,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/products/:id" }),
    handler: handleAdminProductDetail,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/products/:id" }),
    handler: handleAdminProductUpdate,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/products/:id/translations" }),
    handler: handleAdminProductTranslations,
    noStore: true,
  },
  {
    method: "PUT",
    pattern: new URLPattern({ pathname: "/api/admin/products/:id/translations" }),
    handler: handleAdminProductTranslations,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/reviews" }),
    handler: handleAdminReviews,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/reviews/:id" }),
    handler: handleAdminReviewDetail,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/reviews/:id" }),
    handler: handleAdminReviewUpdate,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/comments" }),
    handler: handleAdminComments,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/users" }),
    handler: handleAdminUsers,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/users/:userId" }),
    handler: handleAdminUserDetail,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/users/:userId" }),
    handler: handleAdminUserUpdate,
    noStore: true,
  },
  {
    method: "GET",
    pattern: new URLPattern({ pathname: "/api/admin/reports" }),
    handler: handleAdminReports,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/reports/:id" }),
    handler: handleAdminReportPatch,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/reviews/:id/status" }),
    handler: handleAdminReviewStatus,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/comments/:id/status" }),
    handler: handleAdminCommentStatus,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/comments/:id" }),
    handler: handleAdminCommentUpdate,
    noStore: true,
  },
  {
    method: "PATCH",
    pattern: new URLPattern({ pathname: "/api/admin/users/:userId/role" }),
    handler: handleAdminUserRole,
    noStore: true,
  },
];

function matchRoute(request: Request): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== request.method) {
      continue;
    }
    const match = route.pattern.exec(request.url);
    if (match) {
      return { route, params: match.pathname.groups };
    }
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const requestId = crypto.randomUUID();
    if (request.method === "OPTIONS") {
      return addRequestId(handleOptions(request), requestId);
    }

    try {
      const parsedEnv = getEnv(env);
      const match = matchRoute(request);
      if (!match) {
        const notFound = errorResponse(404, "Not Found");
        return addRequestId(applyCors(notFound, request), requestId);
      }

      const url = new URL(request.url);
      const context: HandlerContext = {
        request,
        url,
        params: match.params,
        env: parsedEnv,
        ctx,
      };

      const handler = () => match.route.handler(context);
      const response = match.route.cacheTtl
        ? await cacheResponse(request, ctx, match.route.cacheTtl(parsedEnv), handler)
        : await handler();

      const withNoStore = match.route.noStore
        ? new Response(response.body, response)
        : response;
      if (match.route.noStore) {
        withNoStore.headers.set("Cache-Control", "no-store");
      }

      const withCors = applyCors(withNoStore, request);
      return addRequestId(withCors, requestId);
    } catch (error) {
      let response: Response;
      if (error instanceof HttpError) {
        response = errorResponse(
          error.status,
          error.message,
          error.details,
          error.headers
        );
      } else if (error instanceof ZodError) {
        response = errorResponse(400, "Invalid request", error.flatten());
      } else {
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Internal Server Error";
        console.error(
          JSON.stringify({
            level: "error",
            message: "request_error",
            requestId,
            error: message,
          })
        );
        response = errorResponse(500, message);
      }

      const withCors = applyCors(response, request);
      return addRequestId(withCors, requestId);
    }
  },
  async scheduled(_: ScheduledController, env: Env, ctx: ExecutionContext) {
    const parsedEnv = getEnv(env);
    ctx.waitUntil(refreshLeaderboardStats(parsedEnv));
    ctx.waitUntil(warmupCache(parsedEnv));
  },
};
