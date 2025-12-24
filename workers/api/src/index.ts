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
  searchProducts,
  upsertProductTranslations,
  updateAdminProduct,
} from "./services/products";
import { searchReviews } from "./services/search";
import { fetchUserProfileRecord } from "./services/users";
import { createPresignedUploadUrl } from "./services/uploads";
import {
  createReport,
  fetchReports,
  updateReportStatus,
} from "./services/reports";
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
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage } from "./utils/i18n";
import type { UploadHealth } from "./types";

const MAX_SITEMAP_PAGE_SIZE = 50000;
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

const langSchema = z
  .string()
  .optional()
  .transform((value) => normalizeLanguage(value));

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
});

const latestQuerySchema = z.object({
  cursor: cursorSchema,
  limit: limitSchema,
  lang: langSchema,
});

const listQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  subCategoryId: z.coerce.number().int().positive().optional(),
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
  status: z.enum(["open", "resolved", "rejected"]).optional(),
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

const profileUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[a-z0-9_-]+$/i, "username must be alphanumeric with - or _.")
      .optional(),
    bio: z.string().trim().max(280).optional().nullable(),
    profilePicUrl: z.string().url().optional().nullable(),
  })
  .refine(
    (value) =>
      value.username !== undefined ||
      value.bio !== undefined ||
      value.profilePicUrl !== undefined,
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

function buildUrlset(urls: Array<{ loc: string; lastmod?: string }>): string {
  const entries = urls
    .map((item) => {
      const lastmod = item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : "";
      return `<url><loc>${escapeXml(item.loc)}</loc>${lastmod}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

function buildSitemapIndex(urls: string[]): string {
  const entries = urls
    .map((url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

const POPULAR_LIMITS = [3, 4, 6];
const LATEST_LIMITS = [3];
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
  const { limit, lang } = popularQuerySchema.parse(getQueryObject(url));
  const reviews = await fetchPopularReviews(env, limit, lang);
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

async function handleReviewsList({ env, url }: HandlerContext): Promise<Response> {
  const { categoryId, subCategoryId, sort, page, pageSize, lang } =
    listQuerySchema.parse(getQueryObject(url));
  const result = await fetchReviews(env, {
    categoryId,
    subCategoryId,
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
  const result = await incrementReviewViews(env, id);
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
  const { part, pageSize, lang } = sitemapReviewsQuerySchema.parse(getQueryObject(url));
  const result = await fetchSitemapReviews(env, part, pageSize, lang);
  return jsonResponse(result);
}

async function handleSitemapProductsJson({ env, url }: HandlerContext): Promise<Response> {
  const { part, pageSize, lang } = sitemapReviewsQuerySchema.parse(getQueryObject(url));
  const result = await fetchSitemapProducts(env, part, pageSize, lang);
  return jsonResponse(result);
}

async function handleSitemapCategoriesJson({ env, url }: HandlerContext): Promise<Response> {
  const { lang } = z.object({ lang: langSchema }).parse(getQueryObject(url));
  const result = await fetchSitemapCategories(env, lang);
  return jsonResponse(result);
}

async function handleSitemapIndexXml({ env, request }: HandlerContext): Promise<Response> {
  const origin = new URL(request.url).origin;
  const { lang } = z.object({ lang: langSchema }).parse(
    getQueryObject(new URL(request.url))
  );
  const reviewCount = await fetchSitemapReviewCount(env, lang);
  const productCount = await fetchSitemapProductCount(env, lang);
  const pageSize = 5000;
  const totalPages = Math.ceil(reviewCount / pageSize);
  const productPages = Math.ceil(productCount / pageSize);
  const urls = [] as string[];
  urls.push(`${origin}/api/sitemap-categories.xml?lang=${lang}`);
  for (let part = 1; part <= productPages; part += 1) {
    urls.push(`${origin}/api/sitemap-products?part=${part}&lang=${lang}`);
  }
  for (let part = 1; part <= totalPages; part += 1) {
    urls.push(`${origin}/api/sitemap-reviews?part=${part}&lang=${lang}`);
  }
  return xmlResponse(buildSitemapIndex(urls));
}

async function handleSitemapCategoriesXml({ env, request }: HandlerContext): Promise<Response> {
  const origin = new URL(request.url).origin;
  const { lang } = z.object({ lang: langSchema }).parse(
    getQueryObject(new URL(request.url))
  );
  const categories = await fetchSitemapCategories(env, lang);
  const urls = [
    `${origin}/${lang}`,
    `${origin}/${lang}/catalog`,
    `${origin}/${lang}/contact`,
    `${origin}/${lang}/privacy-policy`,
    `${origin}/${lang}/terms-of-use`,
  ];
  for (const category of categories.items) {
    urls.push(`${origin}/${lang}/catalog/reviews/${category.id}`);
  }
  return xmlResponse(buildUrlset(urls.map((loc) => ({ loc }))));
}

async function handleSitemapReviewsXml({ env, request, url }: HandlerContext): Promise<Response> {
  const origin = new URL(request.url).origin;
  const { part, pageSize, lang } = sitemapReviewsQuerySchema.parse(getQueryObject(url));
  const result = await fetchSitemapReviews(env, part, pageSize, lang);
  const urls = result.items.map((item) => ({
    loc: `${origin}/${lang}/content/${item.slug}`,
    lastmod: item.updatedAt ?? item.createdAt,
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
  }));
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
  const { status, page, pageSize, lang } = adminProductQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchAdminProducts(env, { status, page, pageSize, lang });
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
  const { status, page, pageSize, lang } = adminReviewQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchAdminReviews(env, { status, page, pageSize, lang });
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
  const { status, reviewId, page, pageSize } = adminCommentQuerySchema.parse(
    getQueryObject(url)
  );
  const result = await fetchAdminComments(env, { status, reviewId, page, pageSize });
  return jsonResponse(result, { headers: { "Cache-Control": "no-store" } });
}

async function handleAdminUsers({ env, request, url }: HandlerContext): Promise<Response> {
  const user = await requireAuth(request, env);
  requireRole(user, "admin");
  const { page, pageSize } = adminUserQuerySchema.parse(getQueryObject(url));
  const result = await fetchAdminUsers(env, { page, pageSize });
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
  const { status, page, pageSize } = reportQuerySchema.parse(getQueryObject(url));
  const result = await fetchReports(env, { status, page, pageSize });
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
  const payload = profileUpdateSchema.parse(await readJson(request));
  const updatePayload: {
    username?: string;
    bio?: string | null;
    profilePicUrl?: string | null;
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
  const updated = await updateProfileByUserId(env, userId, updatePayload);
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
    pattern: new URLPattern({ pathname: "/api/search" }),
    handler: handleSearch,
    cacheTtl: (env) => env.CACHE_TTL_SEARCH_SEC,
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
};
