import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { fetchReviewsByUserId } from "../services/reviewsService";
import { fetchUserProfileRecord } from "../services/usersService";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../utils/pagination";

const usernameParamSchema = z.object({
  username: z.string().min(1),
});

const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export async function getUserProfile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username } = usernameParamSchema.parse(req.params);
    const record = await fetchUserProfileRecord(username);
    if (!record) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(record.profile);
  } catch (error) {
    next(error);
  }
}

export async function listUserReviews(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username } = usernameParamSchema.parse(req.params);
    const { page, pageSize } = reviewsQuerySchema.parse(req.query);
    const record = await fetchUserProfileRecord(username);
    if (!record) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const result = await fetchReviewsByUserId(record.userId, page, pageSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
