import { Router } from "express";
import {
  getCategories,
  getSubcategories,
} from "../controllers/categoriesController";
import { cacheResponse } from "../middleware/cache";
import { env } from "../env";
import { CACHE_PREFIXES } from "../utils/cacheKeys";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  cacheResponse({
    prefix: CACHE_PREFIXES.categories,
    ttlSeconds: env.CACHE_TTL_CATEGORIES_SEC,
  }),
  getCategories
);
categoriesRouter.get(
  "/:id/subcategories",
  cacheResponse({
    prefix: CACHE_PREFIXES.subcategories,
    ttlSeconds: env.CACHE_TTL_SUBCATEGORIES_SEC,
  }),
  getSubcategories
);
