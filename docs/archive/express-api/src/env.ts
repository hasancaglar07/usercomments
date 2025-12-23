import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  REDIS_URL: z.string().min(1).optional(),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  REQUEST_BODY_LIMIT: z.string().min(1).default("1mb"),
  SERVER_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  SERVER_HEADERS_TIMEOUT_MS: z.coerce.number().int().positive().default(35000),
  SERVER_KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CACHE_MAX_ITEMS: z.coerce.number().int().positive().default(500),
  CACHE_TTL_CATEGORIES_SEC: z.coerce.number().int().positive().default(21600),
  CACHE_TTL_SUBCATEGORIES_SEC: z.coerce.number().int().positive().default(21600),
  CACHE_TTL_POPULAR_SEC: z.coerce.number().int().positive().default(45),
  CACHE_TTL_LATEST_SEC: z.coerce.number().int().positive().default(45),
  CACHE_TTL_REVIEW_LIST_SEC: z.coerce.number().int().positive().default(60),
  CACHE_TTL_REVIEW_SEC: z.coerce.number().int().positive().default(90),
  CACHE_TTL_USER_SEC: z.coerce.number().int().positive().default(90),
  CACHE_TTL_USER_REVIEWS_SEC: z.coerce.number().int().positive().default(90),
  CACHE_TTL_SEARCH_SEC: z.coerce.number().int().positive().default(30),
  CACHE_TTL_SITEMAP_SEC: z.coerce.number().int().positive().default(300),
  R2_ENDPOINT: z.string().min(1).optional(),
  R2_REGION: z.string().min(1).default("auto"),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_PUBLIC_BASE_URL: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
