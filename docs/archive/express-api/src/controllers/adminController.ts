import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { fetchReports, updateReportStatus } from "../services/reportsService";
import {
  updateCommentStatus,
  updateReviewStatus,
  updateUserRole,
} from "../services/moderationService";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../utils/pagination";
import {
  buildCacheKey,
  buildPrefix,
  deleteByPrefix,
  deleteCache,
} from "../utils/cache";
import { CACHE_PREFIXES } from "../utils/cacheKeys";
import { fetchReviewMetaById } from "../services/reviewsService";

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

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const reviewStatusSchema = z.object({
  status: z.enum(["published", "hidden", "deleted"]),
});

const commentStatusSchema = z.object({
  status: z.enum(["published", "hidden", "deleted"]),
});

const userRoleSchema = z.object({
  role: z.enum(["user", "moderator", "admin"]),
});

async function invalidateReviewLists() {
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.reviewsLatest));
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.reviewsPopular));
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.reviewsList));
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.search));
  await deleteByPrefix(buildPrefix(CACHE_PREFIXES.sitemapReviews));
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

export async function getReports(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { status, page, pageSize } = reportQuerySchema.parse(req.query);
    const result = await fetchReports({ status, page, pageSize });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function patchReportStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { status } = reportStatusSchema.parse(req.body);
    const report = await updateReportStatus(id, status);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json(report);
  } catch (error) {
    next(error);
  }
}

export async function patchReviewStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { status } = reviewStatusSchema.parse(req.body);
    const review = await updateReviewStatus(id, status);
    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    await invalidateReviewLists();
    await invalidateUserCaches();
    if (review.slug) {
      await invalidateReviewDetailBySlug(review.slug);
    }

    res.json({ id: review.id, status: review.status });
  } catch (error) {
    next(error);
  }
}

export async function patchCommentStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { status } = commentStatusSchema.parse(req.body);
    const comment = await updateCommentStatus(id, status);
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    const meta = await fetchReviewMetaById(comment.reviewId);
    if (meta?.slug) {
      await invalidateReviewDetailBySlug(meta.slug);
    }

    res.json({ id: comment.id, status: comment.status });
  } catch (error) {
    next(error);
  }
}

export async function patchUserRole(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = z
      .object({ userId: z.string().uuid() })
      .parse(req.params);
    const { role } = userRoleSchema.parse(req.body);
    const updated = await updateUserRole(userId, role);
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
}
