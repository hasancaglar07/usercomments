import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  fetchSitemapCategories,
  fetchSitemapReviews,
} from "../services/sitemapService";

const MAX_SITEMAP_PAGE_SIZE = 50000;

const reviewsQuerySchema = z.object({
  part: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_SITEMAP_PAGE_SIZE)
    .default(5000),
});

export async function getSitemapReviews(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { part, pageSize } = reviewsQuerySchema.parse(req.query);
    const result = await fetchSitemapReviews(part, pageSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSitemapCategories(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await fetchSitemapCategories();
    res.json(result);
  } catch (error) {
    next(error);
  }
}
