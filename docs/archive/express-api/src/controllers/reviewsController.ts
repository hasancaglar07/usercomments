import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  fetchLatestReviews,
  fetchPopularReviews,
  fetchReviewBySlug,
  fetchReviewComments,
  fetchReviews,
  createReview,
  addComment,
  addVote,
  fetchReviewMetaById,
} from "../services/reviewsService";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPaginationInfo,
} from "../utils/pagination";
import {
  buildCacheKey,
  buildPrefix,
  deleteByPrefix,
  deleteCache,
} from "../utils/cache";
import { CACHE_PREFIXES } from "../utils/cacheKeys";

async function invalidateReviewLists() {
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.reviewsLatest));
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.reviewsPopular));
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.reviewsList));
}

async function invalidateUserCaches() {
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.usersProfile));
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.usersReviews));
}

async function invalidateReviewDetailBySlug(slug: string) {
  const key = buildCacheKey(
    CACHE_PREFIXES.reviewsSlug,
    `/api/reviews/slug/${slug}`
  );
  await deleteCache(key);
}

const limitSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(MAX_PAGE_SIZE)
  .default(DEFAULT_PAGE_SIZE);

const cursorSchema = z
  .string()
  .optional()
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
    message: "cursor must be a valid date string",
  });

const popularQuerySchema = z.object({
  limit: limitSchema,
});

const latestQuerySchema = z.object({
  cursor: cursorSchema,
  limit: limitSchema,
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
});

const slugParamSchema = z.object({
  slug: z.string().min(1),
});

const commentParamsSchema = z.object({
  id: z.string().uuid(),
});

const commentQuerySchema = z.object({
  cursor: cursorSchema,
  limit: limitSchema,
});

const createReviewSchema = z.object({
  title: z.string().min(3),
  excerpt: z.string().min(10),
  contentHtml: z.string().min(10),
  rating: z.number().min(0).max(5),
  categoryId: z.number().int().positive(),
  subCategoryId: z.number().int().positive().optional(),
  photoUrls: z.array(z.string().url()).default([]),
});

const createCommentSchema = z.object({
  text: z.string().min(1).max(2000),
});

const voteSchema = z.object({
  type: z.enum(["up", "down"]).default("up"),
});

export async function getPopularReviews(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { limit } = popularQuerySchema.parse(req.query);
    const reviews = await fetchPopularReviews(limit);
    res.json({
      items: reviews,
      pageInfo: buildPaginationInfo(1, reviews.length, reviews.length),
    });
  } catch (error) {
    next(error);
  }
}

export async function getLatestReviews(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { cursor, limit } = latestQuerySchema.parse(req.query);
    const result = await fetchLatestReviews(cursor ?? null, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listReviews(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { categoryId, subCategoryId, sort, page, pageSize } =
      listQuerySchema.parse(req.query);
    const result = await fetchReviews({
      categoryId,
      subCategoryId,
      sort: sort ?? "latest",
      page,
      pageSize,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getReviewBySlug(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { slug } = slugParamSchema.parse(req.params);
    const review = await fetchReviewBySlug(slug);
    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    res.json(review);
  } catch (error) {
    next(error);
  }
}

export async function getReviewComments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = commentParamsSchema.parse(req.params);
    const meta = await fetchReviewMetaById(id);
    if (!meta || meta.status !== "published") {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    const { cursor, limit } = commentQuerySchema.parse(req.query);
    const result = await fetchReviewComments(id, cursor ?? null, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function postReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = createReviewSchema.parse(req.body);
    const result = await createReview({
      title: payload.title,
      excerpt: payload.excerpt,
      contentHtml: payload.contentHtml,
      rating: payload.rating,
      categoryId: payload.categoryId,
      subCategoryId: payload.subCategoryId ?? null,
      photoUrls: payload.photoUrls ?? [],
      userId: req.user.id,
    });

    await invalidateReviewLists();
    await invalidateUserCaches();

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = commentParamsSchema.parse(req.params);
    const meta = await fetchReviewMetaById(id);
    if (!meta || meta.status !== "published") {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    const { text } = createCommentSchema.parse(req.body);
    const comment = await addComment({
      reviewId: id,
      userId: req.user.id,
      text,
    });
    if (meta.slug) {
      await invalidateReviewDetailBySlug(meta.slug);
    }
    await invalidateReviewLists();
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

export async function postVote(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = commentParamsSchema.parse(req.params);
    const meta = await fetchReviewMetaById(id);
    if (!meta || meta.status !== "published") {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    const { type } = voteSchema.parse(req.body ?? {});
    const result = await addVote({
      reviewId: id,
      userId: req.user?.id ?? null,
      ipHash: req.voteIdentity?.ipHash ?? null,
      type,
    });
    if (meta.slug) {
      await invalidateReviewDetailBySlug(meta.slug);
    }
    await invalidateReviewLists();
    res.status(201).json(result);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(error.code) === "23505"
    ) {
      res.status(409).json({ error: "Already voted" });
      return;
    }
    next(error);
  }
}
