import { Router } from "express";
import { searchReviewsHandler } from "../controllers/searchController";
import { cacheResponse } from "../middleware/cache";
import { env } from "../env";
import { CACHE_PREFIXES } from "../utils/cacheKeys";

export const searchRouter = Router();

searchRouter.get(
  "/",
  cacheResponse({
    prefix: CACHE_PREFIXES.search,
    ttlSeconds: env.CACHE_TTL_SEARCH_SEC,
  }),
  searchReviewsHandler
);
