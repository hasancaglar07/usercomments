import { Router } from "express";
import {
  getLatestReviews,
  getPopularReviews,
  getReviewBySlug,
  getReviewComments,
  listReviews,
  postReview,
  postComment,
  postVote,
} from "../controllers/reviewsController";
import { reportReview } from "../controllers/reportsController";
import { requireAuth, requireVoteIdentity } from "../middleware/auth";
import { cacheResponse } from "../middleware/cache";
import { rateLimit } from "../middleware/rateLimit";
import { env } from "../env";
import { CACHE_PREFIXES } from "../utils/cacheKeys";

export const reviewsRouter = Router();

reviewsRouter.get(
  "/popular",
  cacheResponse({
    prefix: CACHE_PREFIXES.reviewsPopular,
    ttlSeconds: env.CACHE_TTL_POPULAR_SEC,
  }),
  getPopularReviews
);
reviewsRouter.get(
  "/latest",
  cacheResponse({
    prefix: CACHE_PREFIXES.reviewsLatest,
    ttlSeconds: env.CACHE_TTL_LATEST_SEC,
  }),
  getLatestReviews
);
reviewsRouter.get(
  "/slug/:slug",
  cacheResponse({
    prefix: CACHE_PREFIXES.reviewsSlug,
    ttlSeconds: env.CACHE_TTL_REVIEW_SEC,
  }),
  getReviewBySlug
);
reviewsRouter.get("/:id/comments", getReviewComments);
reviewsRouter.post("/:id/comments", rateLimit(), requireAuth, postComment);
reviewsRouter.post("/:id/vote", rateLimit(), requireVoteIdentity, postVote);
reviewsRouter.post("/:id/report", rateLimit(), requireAuth, reportReview);
reviewsRouter.get(
  "/",
  cacheResponse({
    prefix: CACHE_PREFIXES.reviewsList,
    ttlSeconds: env.CACHE_TTL_REVIEW_LIST_SEC,
  }),
  listReviews
);
reviewsRouter.post("/", rateLimit(), requireAuth, postReview);
