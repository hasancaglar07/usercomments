import { z } from "zod";

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  B2_S3_ENDPOINT?: string;
  B2_S3_REGION?: string;
  B2_S3_ACCESS_KEY_ID?: string;
  B2_S3_SECRET_ACCESS_KEY?: string;
  B2_S3_BUCKET?: string;
  B2_PUBLIC_BASE_URL?: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  RATE_LIMIT_MAX?: string;
  CACHE_TTL_CATEGORIES_SEC?: string;
  CACHE_TTL_SUBCATEGORIES_SEC?: string;
  CACHE_TTL_LATEST_SEC?: string;
  CACHE_TTL_POPULAR_SEC?: string;
  CACHE_TTL_REVIEW_LIST_SEC?: string;
  CACHE_TTL_REVIEW_SEC?: string;
  CACHE_TTL_REVIEW_COMMENTS_SEC?: string;
  CACHE_TTL_USER_SEC?: string;
  CACHE_TTL_USER_REVIEWS_SEC?: string;
  CACHE_TTL_SEARCH_SEC?: string;
  CACHE_TTL_SITEMAP_SEC?: string;
};

export type ParsedEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  B2_S3_ENDPOINT?: string;
  B2_S3_REGION?: string;
  B2_S3_ACCESS_KEY_ID?: string;
  B2_S3_SECRET_ACCESS_KEY?: string;
  B2_S3_BUCKET?: string;
  B2_PUBLIC_BASE_URL?: string;
  RATE_LIMIT_WINDOW_SEC: number;
  RATE_LIMIT_MAX: number;
  CACHE_TTL_CATEGORIES_SEC: number;
  CACHE_TTL_SUBCATEGORIES_SEC: number;
  CACHE_TTL_LATEST_SEC: number;
  CACHE_TTL_POPULAR_SEC: number;
  CACHE_TTL_REVIEW_LIST_SEC: number;
  CACHE_TTL_REVIEW_SEC: number;
  CACHE_TTL_REVIEW_COMMENTS_SEC: number;
  CACHE_TTL_USER_SEC: number;
  CACHE_TTL_USER_REVIEWS_SEC: number;
  CACHE_TTL_SEARCH_SEC: number;
  CACHE_TTL_SITEMAP_SEC: number;
};

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  B2_S3_ENDPOINT: z.string().min(1).optional(),
  B2_S3_REGION: z.string().min(1).optional(),
  B2_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  B2_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  B2_S3_BUCKET: z.string().min(1).optional(),
  B2_PUBLIC_BASE_URL: z.string().min(1).optional(),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  CACHE_TTL_CATEGORIES_SEC: z.coerce.number().int().positive().default(21600),
  CACHE_TTL_SUBCATEGORIES_SEC: z.coerce.number().int().positive().default(21600),
  CACHE_TTL_LATEST_SEC: z.coerce.number().int().positive().default(45),
  CACHE_TTL_POPULAR_SEC: z.coerce.number().int().positive().default(45),
  CACHE_TTL_REVIEW_LIST_SEC: z.coerce.number().int().positive().default(60),
  CACHE_TTL_REVIEW_SEC: z.coerce.number().int().positive().default(30),
  CACHE_TTL_REVIEW_COMMENTS_SEC: z.coerce.number().int().positive().default(30),
  CACHE_TTL_USER_SEC: z.coerce.number().int().positive().default(90),
  CACHE_TTL_USER_REVIEWS_SEC: z.coerce.number().int().positive().default(90),
  CACHE_TTL_SEARCH_SEC: z.coerce.number().int().positive().default(30),
  CACHE_TTL_SITEMAP_SEC: z.coerce.number().int().positive().default(1800)
});

let parsedEnv: ParsedEnv | null = null;

export function getEnv(env: Env): ParsedEnv {
  if (!parsedEnv) {
    parsedEnv = envSchema.parse(env);
  }
  return parsedEnv;
}
