import { Router } from "express";
import {
  getSitemapCategories,
  getSitemapReviews,
} from "../controllers/sitemapController";
import { cacheResponse } from "../middleware/cache";
import { env } from "../env";
import { CACHE_PREFIXES } from "../utils/cacheKeys";

export const sitemapRouter = Router();

sitemapRouter.get(
  "/reviews",
  cacheResponse({
    prefix: CACHE_PREFIXES.sitemapReviews,
    ttlSeconds: env.CACHE_TTL_SITEMAP_SEC,
  }),
  getSitemapReviews
);
sitemapRouter.get(
  "/categories",
  cacheResponse({
    prefix: CACHE_PREFIXES.sitemapCategories,
    ttlSeconds: env.CACHE_TTL_SITEMAP_SEC,
  }),
  getSitemapCategories
);
