import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { searchReviews } from "../services/searchService";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, buildPaginationInfo } from "../utils/pagination";

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
});

export async function searchReviewsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { q, categoryId, page, pageSize } = searchQuerySchema.parse(req.query);
    const trimmed = q.trim();
    if (!trimmed) {
      res.json({
        items: [],
        pageInfo: buildPaginationInfo(page, pageSize, 0),
      });
      return;
    }
    const result = await searchReviews({
      q: trimmed,
      categoryId,
      page,
      pageSize,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
