import { Router } from "express";
import {
  getUserProfile,
  listUserReviews,
} from "../controllers/usersController";
import { reportUser } from "../controllers/reportsController";
import { cacheResponse } from "../middleware/cache";
import { env } from "../env";
import { CACHE_PREFIXES } from "../utils/cacheKeys";
import { rateLimit } from "../middleware/rateLimit";
import { requireAuth } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.get(
  "/:username/reviews",
  cacheResponse({
    prefix: CACHE_PREFIXES.usersReviews,
    ttlSeconds: env.CACHE_TTL_USER_REVIEWS_SEC,
  }),
  listUserReviews
);
usersRouter.get(
  "/:username",
  cacheResponse({
    prefix: CACHE_PREFIXES.usersProfile,
    ttlSeconds: env.CACHE_TTL_USER_SEC,
  }),
  getUserProfile
);
usersRouter.post("/:userId/report", rateLimit(), requireAuth, reportUser);
